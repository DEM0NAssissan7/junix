/* JUNIX Kernel: The heart of the operating system

Main objectives:
- Be as absolutely minimal as possible - leave everything except the bare essentials to servers
- Microkernel-like architecture
- Behave as close as possible to a real UNIX-like OS (e.g. syscall names and behaviors)

Features:
- Stateless (the kernel doesn't actively run any processes)
- Microkernel: The userspace programs take care of the drivers

TODO:
- UNIX Domain Sockets
- FIFO
*/


/* Syscall definitions

In order for programs to properly be able to call systemcalls, the variable scope needs to be outside the kernel function context.


Syscall sections:
*/

/* File management */

    open; // Create a new file descriptor from inode path; if file doesn't exist, make a new one
var read; // Read data from file descriptor
var write; // Write data to file descriptor
var access; // Check if file exists
var dup; // Duplicate file descriptor
    close; // Close file descriptor
var stat; // See the status of a file (its type, user, permissions, etc)
var unlink; // Delete an inode from the filesystem

/* Directory management */

var mkdir; // Make a new directory
var opendir; // Make a new directory file descriptor from directory path
var listdir; // List file contents of directory file descriptor
var closedir; // Close directory file descriptor
var dirname; // Get the full system path of a file

/* Filesystems */

var mount; // Mount a device at a directory
var umount; // Unmount filesystem at either path or directory
var sync; // Synchronize all cached file changes to disk

/* Process & Thread management */

var getpid; // Get PID of current process
var getuid; // Get User ID of calling process
var getexe; // Get the exec path of the calling process
var fork; // Duplicate current process
var wait; // Suspend current process until a signal is recieved or a child finishes
var exec; // Replace current process code with a program
var thread; // Create a new thread of a callback inside current process
var cancel; // Destroy thread (PID)
var sleep; // Stop running process for x milliseconds
var exit; // Gracefully kill current process
var kill; // Kill a process (PID)
var getppid; // Get current process parent PID
var chdir; // Change working directory of current process
var getcwd; // Get working directory of current process

/* Debug */

var k_eval;
var root_fs;

/* System Managment */

var reboot; // Manipulate system power state
var sysinfo; // View system statistics
var jsopen = open;
var jsclose = close;

/* Kernel Code */

let errno;
{
    let entered = false;
    function kernel_entry(kargs) {
        // Check if previously entered
        if (entered)
            throw new Error("Cannot execute kernel: already entered.");
        entered = true;

        const enter_time = get_time(0);
        function get_uptime() {
            return get_time(0) - enter_time;
        }

        // Logging
        const print_klog = true;
        let klog = [];
        let create_log_entry = function (message, severity) {
            let time = get_uptime();
            klog.push({
                message: message,
                time: time,
                severity: severity
            });
            if (print_klog) {
                const prefix = "[" + time + "] ";
                switch (severity) {
                    case 0:
                        console.log(prefix + message);
                        break;
                    case 1:
                        console.warn(prefix + message);
                        break;
                    case 2:
                        console.error(prefix + message);
                        break;
                }
            }
        }
        let kdebug = function (message) {
            create_log_entry(message, 0);
        }
        let kwarn = function (message) {
            create_log_entry(message, 1);
        }
        let kerror = function (message) {
            create_log_entry(message, 2);
        }
        kdebug("Entered kernel");

        //Panic
        let panic = function (message) {
            stop_kernel();
            sync(); // Make sure disks are synced before presenting error so the user doesn't lose data
            alert("Panic! -> " + message);
            console.error("Kernel panic (" + get_time() + ")");
            console.error(message);
            kerror("Kernel panic: " + message);
            throw new Error("Panic!");
        }

        // Kernel Arguments
        if (!kargs)
            kwarn("No kernel arguments specified. Running kernel headless.");

        // Systemcall management
        let system_time = 0;
        function syscall(callback) {
            return function (...args) {
                if(c_thread === null || c_process === null || c_user === null) {
                    throw new Error("Cannot run systemcall: invalid context " + `(PROCESS: ${c_process}, THREAD: ${c_thread}, USER: ${c_user})`)
                }
                return run_syscall(() => callback(...args));
            }
        }
        function run_syscall(callback) {
            let time = get_time(3);
            let retval = callback();
            user_time -= get_time(3) - time;
            return retval;
        }

        // Descriptors
        class FileDescriptor {
            constructor(data, flags, mode, user, inode, filesystem) {
                this.data = data;
                this.flags = flags;
                this.mode = mode;
                this.user = user;
                this.inode = inode;
                this.filesystem = filesystem;
                if (filesystem)
                    filesystem.fds++;
                if (inode)
                    this.filetype = inode.type;
                this.buffer = data;
                this.events = [];
            }
            update_buffer() {
                if (this.inode)
                    this.buffer = this.inode.get_data();
            }
            read() {
                if (this.filetype === "d") throw new Error("cannot read: is a directory");
                this.update_buffer();
                return this.buffer;
            }
            listdir() {
                if (this.filetype !== "d") throw new Error("Cannot execute listdir(): not a directory");
                let names = [];
                for (let i of this.buffer)
                    names.push(this.filesystem.get_inode(i).filename);
                return names;
            }
            write(data) {
                if (this.filetype !== "-" && this.filetype) throw new Error("Cannot write to a non-normal file");
                this.buffer = data;
                this.flush();
            }
            append(data) {
                this.update_buffer();
                this.write(this.buffer + data);
            }
            close() {
                if (this.filesystem) {
                    this.filesystem.fds--;
                    if (this.filesystem.fds < 0) {
                        console.error(this.filesystem.mountpoint + " fs had " + this.filesystem.fds + " fds");
                        panic("Fatal error occured in routine filesystem check. Something has gone terribly wrong.");
                    }
                }
            }
            flush() {
                if (this.inode)
                    this.inode.write(this.buffer);
            }
        }
        open = syscall(function (path, flags, mode) {
            // Create and return a file descriptor for a file
            if (!path) throw new Error("You must specify a path");
            if (!flags) throw new Error("No flags specified");

            let file = get_file(path);
            let inode = file.inode;
            if (file.incomplete) {
                if (flags === "r") throw new Error("File " + path + " does not exist");
                kdebug("Creating file at " + path);
                inode = file.filesystem.create_file(inode.index, get_filename(path), "", "-", c_user, mode ?? inode.mode);
            }

            let descriptor = new FileDescriptor(inode.get_data(), flags, inode.mode, c_user, inode, file.filesystem);
            return c_process.create_descriptor(descriptor);
        });
        read = syscall(function (fd) {
            return c_process.get_descriptor(fd).read();
        });
        write = syscall(function (fd, data) {
            let descriptor = c_process.get_descriptor(fd);
            switch (descriptor.flags) {
                case 'r':
                    throw new Error("Cannot write to a file descriptor opened as readonly");
                case 'w':
                    descriptor.write(data);
                    break;
                case 'a':
                    descriptor.append(data);
                    break;
            }
        });
        access = syscall(function (path) {
            return !(get_file(path).incomplete);
        });
        dup = syscall(function (fd) {
            c_process.duplicate(fd);
        });
        close = syscall(function (fd) {
            let descriptor = c_process.get_descriptor(fd);
            // descriptor.flush();
            c_process.close(fd);
        });
        stat = syscall(function (path) {
            let inode = get_file(path).inode;
            return {
                type: inode.type,
                user: inode.user,
            }
        });
        unlink = syscall(function (path) {
            let f = get_file(path);
            if (f.inode.type !== "-") throw new Error("Cannot unlink a non-normal file.");
            f.filesystem.delete_file(f.inode.index);
        });
        mkdir = syscall(function (path) {
            let file = get_file(path);
            if (file.incomplete)
                file.filesystem.create_file(file.inode.index, get_filename(path), [], "d", c_user, file.inode.mode);
        });
        opendir = syscall(function (path) {
            let file = get_file(path);
            if (file.incomplete) throw new Error("Directory " + path + " does not exist");
            if (file.inode.type !== "d") throw new Error("opendir() failed: not a directory [" + path + "]");
            let descriptor = new FileDescriptor(file.inode.get_data(), "r", 755, c_user, file.inode, file.filesystem);
            return c_process.create_descriptor(descriptor);
        });
        listdir = syscall(function (fd) {
            return c_process.get_descriptor(fd).listdir();
        });
        closedir = syscall(function (fd) {
            let descriptor = c_process.get_descriptor(fd);
            c_process.close(descriptor);
        });
        dirname = syscall(function (path) {
            return full_path(path);
        });

        // Mounting
        let mount_table = [];
        let mount_fs = function (filesystem, path) {
            let file = get_file(path);
            if (file.incomplete) throw new Error("Cannot mount at " + path + ": directory does not exist");
            if (file.inode.type !== "d") throw new Error("Cannot mount at " + path + ": not a directory");
            if (typeof filesystem !== "object") throw new Error("Cannot mount filesystem: not an object");
            if (filesystem.magic !== 20) throw new Error("Mount failed: not a filesystem");
            // Check if the filesystem already exists in the mount table
            for (let fs of mount_table) {
                if (!fs) continue;
                if (fs.uuid === filesystem.uuid)
                    throw new Error("Mount failed: Filesystem is already mounted at mountpoint '" + fs.parent_inode.filename + "'");
            }

            file.inode.mount(mount_table.length);
            filesystem.mount(mount_table.length, file.inode);
            mount_table.push(filesystem);
        }
        mount = syscall(function (device, path) {
            let file = get_file(device);
            if (file.incomplete) throw new Error("Device does not exist at " + device)
            let fs = file.inode.get_data();
            mount_fs(fs, path);
            kdebug("Device " + full_path(device) + " mounted at " + full_path(path));
        });
        function is_busy(filesystem) {
            if (filesystem.fds > 0) return true;
            return false;
        }
        let unmount_fs = function (filesystem) {
            if (!filesystem || typeof filesystem !== "object") throw new Error("Filesystem invalid");
            if (filesystem.magic !== 20) throw new Error("Filesystem invalid");
            if (filesystem.mountpoint === false) throw new Error("Cannot unmount filesystem: not mounted");
            let inode = filesystem.parent_inode;

            if (inode.mountpoint === false) throw new Error("Cannot unmount filesystem: not mounted(?)");
            if (is_busy(filesystem)) throw new Error("filesystem is busy");
            filesystem.sync(); // Sync filesystem before unmounting
            mount_table[filesystem.mountpoint] = undefined;
            inode.mountpoint = false;
            filesystem.mountpoint = false;
            filesystem.inodes[0].mountpoint = false;
        }
        let unmount_all = function () {
            for (let fs of mount_table)
                if (fs && typeof fs === "object")
                    unmount_fs(fs);
        }
        umount = syscall(function (path) {
            let file = get_file(path);
            if (file.incomplete) throw new Error("File does not exist at " + path);
            let filesystem;
            if (file.inode.type === "d") {
                filesystem = mount_table[file.inode.mountpoint];
            }
            else if (typeof file.inode.get_data() === "object")
                filesystem = file.inode.get_data();
            unmount_fs(filesystem);
            return 0;
        });
        sync = syscall(function () {
            for (let fs of mount_table) {
                if (!fs) continue;
                fs.sync();
            }
        });

        // Kernel file tools
        let full_path_dirty = function (path) {
            let working_path = "";
            if (c_process) {
                if (path[0] !== "/")
                    working_path = c_process.working_path;
            }
            return working_path + "/" + path;
        }
        let map_full_path_names = function (path) {
            return map_path_names(full_path_dirty(path))
        }
        let full_path = function (path) {
            return consolidate_path_names(map_full_path_names(path));
        }
        let get_file = function (path) {
            if (!path) throw new Error("No path specified");
            let path_names = map_full_path_names(path);
            let filesystem = mount_table[0];
            if (!filesystem) throw new Error("No root filesystem");
            let index = 0;
            let inode = filesystem.get_inode(index);
            let name_index = 0;

            let steps = path_names.length;
            while (steps > 0) {
                inode = filesystem.get_inode(index);
                if (inode.type === "l") return get_file(inode.get_data());
                if (inode.type !== "d") break;
                let success = false;

                let data = inode.get_data();
                let path_name = path_names[name_index];
                for (let _index of data) {
                    let _inode = filesystem.get_inode(_index);
                    if (_inode.filename === path_name) {
                        success = true;
                        index = _index;
                        inode = _inode;
                        if (_inode.mountpoint !== false) {
                            filesystem = mount_table[_inode.mountpoint];
                            index = 0;
                            inode = filesystem.get_inode(index);
                        }
                        break;
                    }
                }
                if (!success) break;
                name_index++;
                steps--;
            }

            return {
                filesystem: filesystem,
                inode: inode,
                incomplete: steps !== 0
            };
        }

        // Process
        let processes = [];
        let pids = 1;
        let user_time = 0;
        let c_process, c_user, c_thread;
        class Thread {
            constructor(process, exec, pid, args) {
                this.process = process;
                this.exec = exec;
                this.pid = pid;
                this.args = args ?? [];
                this.sleep = 0;
                this.initialized = false;
                this.done = false;
                this.last_exec = 0;
            }
            is_ready(time) {
                if (this.sleep < 0) return false;
                if (time >= this.last_exec + this.sleep)
                    return true;
                return false;
            }
            slept(time) {
                if (this.sleep === 0)
                    return false;
                return this.is_ready(time);
            }
            run(time) {
                thread.exec_time = time;
                (async () => {
                    // Set system context
                    c_process = this.process;
                    c_thread = this;
                    c_user = this.process.user;
                    
                    this.initialized = true;

                    try {                        
                        await this.exec(...this.args);
                    } catch (e) {
                        if (!is_interrupt(e)) {
                            console.error(this.process.cmdline + " (" + this.process.pid + ") encountered an error (thread: " + this.pid + ")");
                            console.error(e);
                            try {
                                fprintf(stderr, this.process.command + ": " + e.message + "\n");
                            } catch (e) {
                                console.warn("No stderr");
                            }
                            this.process.kill();
                        }
                    }
                    this.done = true;
                    this.process.check_dead();
                })()
            }
        }
        class Process {
            constructor(code_object, user, working_path) {
                this.descriptor_table = [];

                this.cmdline = null;
                this.command = null;
                this.waiting = false;
                this.suspended = false;
                this.dead = false;

                this.working_path = working_path;
                this.time_created = get_time(3);
                this.waited = 0;
                this.cputime = 0;

                this.pid = pids;
                this.user = user;
                this.code = code_object; // Pass in code object, must already be created from 'new' statment beforehand
                this.children = [];
                this.child_index = 0;
                this.parent = this;
                this.threads = [];
                this.add_thread(this.code.main, []);

                this.exec_time = 0;
            }
            exec(code, args, path) {
                if(!code.main) throw new Error("Exec: specified code does not have a .main method");
                this.code = code; // Replace process code object with exec
                this.cmdline = path;
                this.command = get_filename(path);
                let main = new Thread(this, this.code.main, this.pid, args)
                this.threads = [main]
                main.run(get_time(3)); // Start the main thread
            }
            clone_descriptors() {
                let retval = [];
                for (let descriptor of this.descriptor_table) {
                    if (!descriptor) {
                        retval.push(undefined);
                        continue;
                    }
                    retval.push(new FileDescriptor(descriptor.data, descriptor.flags, descriptor.mode, descriptor.user, descriptor.inode, descriptor.filesystem));
                }
                return retval;
            }
            clone(intermediate_code) {
                let code = Object.assign(Object.create(Object.getPrototypeOf(this.code)), this.code); // Clone the process running code
                let p = new Process(code, this.user, this.working_path);
                this.children.push(p);
                p.cmdline = this.cmdline;
                p.command = this.command;
                p.parent = this;
                p.child_index = this.children.length - 1;
                p.descriptor_table = this.clone_descriptors();

                // Run intermediate code because javascript is unable to behave exactly like a real kernel
                if (intermediate_code) {
                    let process = c_process;
                    let thread = c_thread;
                    let user = c_user;

                    c_process = p;
                    c_thread = p.threads[0];
                    c_user = p.user;
                    try {
                        intermediate_code();
                    } catch (e) {
                        this.signal(20);
                        throw new Error("Could not fork process: " + e)
                    }
                    c_process = process;
                    c_thread = thread;
                    c_user = user;
                }
                return p;
            }
            is_available() {
                if (this.suspended ||
                    this.dead ||
                    this.waiting)
                    return false;
                return true;
            }
            branch_thread(exec, args) {
                let thread = new Thread(this, exec, pids, args);
                this.threads.push(thread);
                thread.run(); // Start the thread after creation
            }
            add_thread(exec, args) {
                this.threads.push(new Thread(this, exec, pids, args));
                return pids++;
            }
            get_thread(pid) {
                for (let thread of this.threads) {
                    if (thread.pid === pid)
                        return thread;
                }
                return null;
            }
            cancel_thread(pid) {
                let thread = null;
                let i = 0;
                for (; i < this.threads.length; i++) {
                    if (this.threads[i].pid === pid) {
                        thread = this.threads[i];
                        break;
                    }
                }
                if (thread === null) throw new Error("Thread " + pid + " does not exist on this process");
                this.threads.splice(i, 1);
            }
            add_descriptor(descriptor) {
                for (let i = 0; i <= this.descriptor_table.length; i++) {
                    if (!this.descriptor_table[i]) {
                        this.descriptor_table[i] = descriptor;
                        return i;
                    }
                }
                return null;
            }
            create_descriptor(descriptor) {
                let r = this.add_descriptor(descriptor);
                if (r === null) throw new Error("Could not create file descriptor: unknown error")
                return r;
            }
            get_descriptor(fd) {
                let descriptor = this.descriptor_table[fd];
                if (!descriptor) throw new Error("No descriptor at " + fd);
                return descriptor;
            }
            close(fd) {
                if (!this.descriptor_table[fd]) throw new Error("No file descriptor at " + fd);
                this.descriptor_table[fd].close();
                this.descriptor_table[fd] = undefined;
            }
            duplicate(fd) {
                let descriptor = this.get_descriptor(fd);
                if (descriptor.filesystem)
                    descriptor.filesystem.fds++;
                return this.add_descriptor(descriptor);
            }
            signal(code) {
                switch (code) {
                    case 9:
                        this.kill();
                        if (c_process.pid === this.pid) interrupt();
                        break;
                    case 15:
                        this.kill();
                        if (c_process.pid === this.pid) interrupt();
                        break;
                }
                this.unfreeze();
                this.waiting = false;
            }
            unfreeze() {
                // Just here to prevent errors. This function is assigned by asyncwait()
            }
            kill() {
                for (let i = 0; i < this.descriptor_table.length; i++) {
                    let descriptor = this.descriptor_table[i];
                    if (!descriptor) continue;
                    this.close(i);
                }
                this.dead = true;
                check_dead_processes();
            }
            check_dead() {
                for(let thread of this.threads) {
                    // Check if the process has no active threads
                    if(!thread.done)
                        return;
                }
                // If it has no active threads, it kills itself.
                this.dead = true;
                setInterval(check_dead_processes);
            }
            wait() {
                this.waiting = true;
            }
            start() {
                if(this.threads.length > 0) {
                    this.threads[0].run(); // Execute main thread
                } else {
                    throw new Error("Cannot start process: no threads");
                }
            }
            get_cpu_time(){
                const time = get_time(3);
                return time - this.time_created - this.waited
            }
        }
        let get_process = function (pid) {
            for (let process of processes)
                if (process.pid === pid) return process;
        }
        let asyncwait = function(handler) {
            let user = c_user;
            let thread = c_thread;
            let process = c_process;
            
            // Unassign context
            // c_user = null;
            // c_thread = null;
            // c_process = null;

            const time = get_time(3);

            let post_wait = () => {
                process.waited += get_time(3) - time;
                c_user = user;
                c_thread = thread;
                c_process = process;
            }
            if(process.waiting) {
                let unfreeze = process.unfreeze;
                return new Promise(a => {
                    process.unfreeze = () => {
                        unfreeze();
                        a();
                    }
                }).then(post_wait);
            }
            // If the process is dead, we make the promise unresolvable to prevent further execution.
            if(process.dead) {
                return new Promise(a => {});
            }

            return new Promise(resolve => {
                handler(resolve);
            }).then(post_wait);
        }
        getpid = syscall(function () {
            return c_process.pid;
        });
        getuid = syscall(function () {
            return c_process.user;
        });
        getexe = syscall(function () {
            return c_process.cmdline;
        })
        fork = syscall(function (intermediate_code) {
            if (!c_process) panic("Fork was run outside of kernel context");
            let process = c_process.clone(intermediate_code);
            if (process)
                processes.push(process);
            else
                return -1;
            return process.pid;
        });
        wait = syscall(async function () {
            if (!c_process) panic("wait() was run outside of kernel context");
            c_process.waiting = true;
            if (c_process.children.length !== 0)
                return asyncwait();
        });
        exec = syscall(function (path, ...args) {
            let file = get_file(path);
            if (file.incomplete) throw new Error("File at " + path + " does not exist.");
            let code_object = file.inode.get_data();
            let code = new code_object();
            c_process.exec(code, args ?? [], full_path(path));
        });
        thread = syscall(function (exec, args) {
            return c_process.branch_thread(exec, args);
        });
        cancel = syscall(function (pid) {
            c_process.cancel_thread(pid);
        });
        sleep = syscall(async function (time) {
            return asyncwait(a => setTimeout(a, time))
        });
        exit = syscall(function () {
            c_process.kill();
            interrupt();
        });
        kill = syscall(function (pid, sig) {
            let process = get_process(pid)
            if (!process) throw new Error("No process with PID " + pid);
            process.signal(sig);
        });
        getppid = syscall(function () {
            let parent = c_process.parent;
            if (!parent) throw new Error("Process does not have a parent.")
            return parent.pid;
        });
        chdir = syscall(function (path) {
            let new_working_path = full_path(path);
            if (!access(new_working_path))
                throw new Error(new_working_path + " does not exist.");
            return c_process.working_path = new_working_path;
        });
        getcwd = syscall(function () {
            return c_process.working_path;
        });

        // Stateless Process Management
        function check_dead_processes() {
            for (let i = 0; i < processes.length; i++) {
                let process = processes[i];
                if (process.dead) {
                    processes.splice(i, 1);
                    process.parent.signal(20);
                    i--;
                    continue;
                }
            }
        }

        // Debug
        const debug = true;
        if (debug) {
            k_eval = function (string) {
                return eval(string);
            }
        }

        // tmpfs
        /* In order to be able to index devices in the filesystem tree,
            we need to create a very early filesystem that can be used to
            provide a ground to map devices and other stuff. It's generally good
            practice to have an early root filesystem anyways.
            */

        // Root & tmpfs
        let mount_root = function (filesystem) {
            filesystem.mount(0, "/");
            mount_table[0] = filesystem;
        }
        let mount_root_device = function (device) {
            let file = get_file(device);
            if (file.incomplete) throw new Error("Device does not exist at " + device)
            let fs = file.inode.get_data();
            fs.mount(0, "/");
            mount_table[0] = fs;
            kdebug("Device " + full_path(device) + " mounted at /");
        }
        function create_init_rootfs() {
            kdebug("Mounting initial rootfs");
            mount_root(new JFS());
        }
        create_init_rootfs();

        /* Kernel-level device management */
        let devfs;
        let device_pointers = [];
        let device_inodes = [];
        let create_device_pointer = function (device, name) {
            kdebug("Created device " + name);
            device_pointers.push({
                device: device,
                name: name
            });
        }
        let create_device_inode = function(inode) {
            kdebug("Created device " + inode.filename);
            device_inodes.push(inode);
        }
        let create_devfs = function () {
            devfs = new JFS();
            mount_fs(devfs, "/dev");
            for (let d of device_pointers)
                devfs.create_file(0, d.name, d.device, "-", 0, 511);
            for (let i of device_inodes) {
                devfs.push_inode(0, i);
            }
        }
        mkdir("/dev"); // Create a temporary /dev
        create_device_pointer(devfs, "devfs");

        // Disk drivers

        /* Disk driver: add disks */
        {
            let disks = 0;
            function add_disk(filesystem) {
                create_device_pointer(filesystem, "disk" + disks++);
            }
        }

        // /dev/null > a secure way to redirect unwanted data
        {
            let inode = new Inode(-1, 0, "null", "", "-", 0, 511);
            inode.get_data = () => "";
            inode.write = () => null;
            create_device_inode(inode);
        }

        /* Localstorage driver: Allow mounting root from local storage */
        function localstorage_driver() {
            kdebug("Starting localstorage driver");
            let string = localStorage.getItem("root");
            let fs = new JFS();
            add_disk(fs);
            create_junix_update_file();
            if (string === null) {
                if (kargs.initfs_table) {
                    kwarn("Populating localstorage with initfs table");
                    rootfs_build(false);
                    string = mount_table[0].stringify();
                } else {
                    panic("Cannot boot: localstorage driver failed to get 'root' from browser data. There was no fallback initfs table.");
                }
            }
            fs.parse(string);
            fs.sync = function () {
                localStorage.setItem("root", fs.stringify());
            }
        }
        if (kargs.use_localstorage_driver)
            localstorage_driver();

        // Root mounting
        /* 'rootfs_build' driver */
        function rootfs_build(create_device) {
            kdebug("Building root filesystem from fs definition table");
            let table = kargs.initfs_table;
            for (let entry of table) {
                if (entry.length === 1)
                    mkdir(entry[0]);
                if (entry.length === 2) {
                    let file = get_file(entry[0]);
                    mount_table[0].create_file(file.inode.index, get_filename(entry[0]), entry[1], "-", 0, 711);
                }
            }
            if (create_device) {
                add_disk(mount_table[0]);
            }
        }
        function create_junix_update_file() {
            let old_fs = mount_table[0];
            mount_table[0] = new JFS();
            kdebug("Creating JUNIX update file");
            let table = kargs.initfs_table;
            for (let entry of table) {
                if (entry.length === 1)
                    mkdir(entry[0]);
                if (entry.length === 2) {
                    let file = get_file(entry[0]);
                    mount_table[0].create_file(file.inode.index, get_filename(entry[0]), entry[1], "-", 0, 711);
                }
            }
            create_device_pointer(mount_table[0], "jupd");
            mount_table[0] = old_fs;
        }
        if (kargs.initfs_table && !kargs.root || kargs.use_initfs_only) {
            rootfs_build(true);
        }
        create_devfs(); // Create /dev filesystem
        if (kargs.root && !kargs.use_initfs_only) {
            kdebug("Mounting root from device map");
            mount_root_device(kargs.root);
            unmount_fs(devfs);
            mount_fs(devfs, "/dev");
        } else if (!kargs.initfs_table) {
            kwarn("Kernel running headless. Tmpfs being used for root.");
        }

        // Init process
        function create_init() {
            kdebug("Creating init");
            let init_code = new function () {
                this.main = function () {
                    kdebug("Running init");
                    exec("/bin/init");
                }
            }
            processes.push(new Process(init_code, 0, "/"));
        }
        function run_init() {
            processes[0].start();
        }
        create_init();
        run_init();

        // Javascript function reassignment. This will help prevent data loss
        system_shutdown = function () {
            try {
                reboot(5);
            } catch (e) {
                kerror(e);
            }
        }
        window.addEventListener("beforeunload", function (e) {
            try {
                reboot(5); // Clean shutdown on unload
            } catch (e) {
                kerror(e);
                sync(); // Sync disk if that fails
            }
            return undefined;
        });

        // System management
        let loop_timeout = 10;
        let reset = function () {
            for(let p of processes)
                p.kill(); // Kill all processes
            purge();
        }
        function purge() {
            processes = [];
            pids = 1;
        }
        function dirty_purge() {
            kwarn("Running dirty purge: all runtime kernel data will be completley lost");
            purge();
            for (let filesystem of mount_table) {
                if(!filesystem) continue;
                filesystem.fds = 0;
                filesystem.mountpoint = false;
                filesystem.parent_inode = null;
                filesystem.inodes[0].mountpoint = null;
            }
            mount_table = [];
        }
        let rebooting = false;
        reboot = syscall(function (op) {
            if (!rebooting) {
                rebooting = true;
                switch (op) {
                    case 2: // Change op to be accurate to actual UNIX
                        kdebug("Soft rebooting system (without unmounting)...");
                        reset();
                        create_init();
                        rebooting = false;
                        break;
                    case 3:
                        // Kernel re-entry (hard reboot)
                        kdebug("Rebooting...");
                        reset();
                        unmount_all();
                        stop_kernel();
                        kernel_entry(kargs); // Re-enter kernel with the same argument. This will completely reinitialize the system.
                        rebooting = false;
                        break;
                    case 4:
                        // Soft shutdown: Reset and do not reboot system
                        kdebug("Soft shutdown...");
                        reset();
                        unmount_all();
                        stop_kernel();
                        break;
                    case 5:
                        // Hard shutdown: Reset and close
                        kdebug("Shutdown...");
                        reset();
                        unmount_all();
                        stop_kernel();
                        jsclose();
                        break;
                    case 6:
                        // Hard Boot (this basically acts like a bootloader that lives in memory)
                        kdebug("Hard Booting...");
                        kernel_entry(kargs);
                        break;
                    case 7:
                        // Reinit
                        kdebug("Reinitializing system...");
                        create_init_rootfs();
                        mkdir("/dev");
                        create_devfs();
                        rootfs_build(true);
                        create_init();
                        rebooting = false;
                        break;
                    case 8:
                        // Kernel stasis: keep kernel alive with no processes (including no init)
                        kdebug("Entering kernel stasis...");
                        reset();
                        unmount_all();
                        rebooting = false;
                        break;
                    case 9:
                        // Panic reboot
                        kdebug("Rebooting from panic");
                        panic = () => {};
                        stop_kernel();
                        dirty_purge();
                        kernel_entry(kargs);
                        rebooting = false;
                        break;
                    default:
                        throw new Error("opcode invalid");
                }
            } else {
                kwarn("Cannot execute reboot: reboot in progress.");
            }
        });
        sysinfo = syscall(function() {
            return {
                loads: [get_user_time()],
                total_time: total_time,
                user_time: get_user_time(),
                system_time: system_time,
                uptime: round(get_uptime()/1000),
                procs: processes.length,

            }
        })

        // Usage counters
        function get_user_time() {
            let t = 0;
            const time = get_time(3);
            for(let process of processes) {
                t += time - process.time_created - process.waited;
            }
            return t;
        }
    }
}