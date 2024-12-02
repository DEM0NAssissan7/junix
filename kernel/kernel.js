/* JUNIX Kernel: The heart of the operating system

Main objectives:
- Be as absolutely minimal as possible - leave everything except the bare essentials to servers
- Microkernel-like architecture
- Behave as close as possible to a real UNIX-like OS (e.g. syscall names and behaviors)

Features:
- Passive Scheduler (the kernel doesn't actively run any tasks in its own context)
- Microkernel: The userspace programs take care of the drivers

TODO:
- Task Scheduler (replace Process[Thread] implementation)
- UNIX Domain Sockets
- FIFO
*/


/* Syscall definitions

In order for programs to properly be able to call systemcalls, the variable scope needs to be outside the kernel function context.


Syscall sections:
*/

//DEBUG: REMOVE
var tasks = [];

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
var cancel; // Stop a running thread (preserves siblings)
var sleep; // Stop running process for x milliseconds
var exit; // Gracefully kill current process
var kill; // Send signal to a process (PID)
var signal; // Capture signal to calling process
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
            console.error("Kernel panic (" + get_uptime() + ")");
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
                if(c_task === null) {
                    throw new Error("Cannot run systemcall: invalid context " + `(TASK: ${c_task})`)
                }
                return run_syscall(() => {
                    // Preserve context across systemcalls to prevent any unwanted context changes
                    let ctx = c_task;
                    let r = callback(...args);
                    c_task = ctx;
                    return r;
                });
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
                if (flags === "r" || file.noparent) throw new Error("File " + path + " does not exist");
                kdebug("Creating file at " + path);
                inode = file.filesystem.create_file(inode.index, get_filename(path), "", "-", c_task.user, mode ?? inode.mode);
            }

            let descriptor = new FileDescriptor(inode.get_data(), flags, inode.mode, c_task.user, inode, file.filesystem);
            return c_task.create_descriptor(descriptor);
        });
        read = syscall(function (fd) {
            return c_task.get_descriptor(fd).read();
        });
        write = syscall(function (fd, data) {
            let descriptor = c_task.get_descriptor(fd);
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
            c_task.duplicate(fd);
        });
        close = syscall(function (fd) {
            let descriptor = c_task.get_descriptor(fd);
            // descriptor.flush();
            c_task.close(fd);
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
                file.filesystem.create_file(file.inode.index, get_filename(path), [], "d", c_task.user, file.inode.mode);
        });
        opendir = syscall(function (path) {
            let file = get_file(path);
            if (file.incomplete) throw new Error("Directory " + path + " does not exist");
            if (file.inode.type !== "d") throw new Error("opendir() failed: not a directory [" + path + "]");
            let descriptor = new FileDescriptor(file.inode.get_data(), "r", 755, c_task.user, file.inode, file.filesystem);
            return c_task.create_descriptor(descriptor);
        });
        listdir = syscall(function (fd) {
            return c_task.get_descriptor(fd).listdir();
        });
        closedir = syscall(function (fd) {
            let descriptor = c_task.get_descriptor(fd);
            c_task.close(descriptor);
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
            if (c_task) {
                if (path[0] !== "/")
                    working_path = c_task.working_path;
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
                incomplete: steps !== 0,
                noparent: steps > 1
            };
        }

        // Context Management
        let c_task = null;

        // Task
        // let tasks = [];
        let pids = 1;
        let user_time = 0;
        function is_async(func) {
            return func[Symbol.toStringTag] === 'AsyncFunction';
        }
        class Task {
            cmdline = null;
            command = null;

            descriptor_table = [];

            waiting = false;
            suspended = false;
            dead = false;

            sigoverrides = [];

            last_exec = 0;
            waited = 0;
            cputime = 0;
            exec_time = 0;

            initialized = false;

            siblings = [this];
            is_main = true;
            children = [];

            constructor(user, working_path, path, code, handler, pid, args) {
                this.cmdline = path;
                this.command = get_filename(path);

                this.working_path = working_path;
                this.time_created = get_time(3);

                this.pid = pids;
                this.user = user;
                this.code = code; // Pass in code object, must already be created from 'new' statment beforehand
                this.parent = this;

                this.handler = handler;
                this.pid = pid;
                this.args = args ?? [];
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
                let code = Object.assign(Object.create(Object.getPrototypeOf(this.code)), this.code); // Clone the task running code
                if(!code.main) throw new Error("Exec: specified code does not have a .main method");
                let t = new Task(this.user, this.working_path, this.cmdline, code, code.main, pids++, this.args);
                t.cmdline = this.cmdline;
                t.command = this.command;
                t.parent = this;
                t.parent_pid = this.pid;
                t.descriptor_table = this.clone_descriptors();

                // Run intermediate code because javascript is unable to behave exactly like a real kernel
                if (intermediate_code) {
                    let context = c_task;
                    t.run_ctx(intermediate_code, is_async(intermediate_code), () => {
                        if(!t.dead) {
                            tasks.push(t);
                            this.children.push(t);
                        } else {
                            // Do not signal immediately to allow wait() to set in before it is signaled. This is useful for the shell.
                            setTimeout(() => {
                                this.signal(20);
                            })
                        }
                        c_task = context;
                    });
                }
                return t;
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
            signal(signum) {
                let override = this.sigoverrides[signum];
                if(override) {
                    override(signum);
                }
                switch (signum) {
                    case 9:
                        this.kill();
                        if (c_task.pid === this.pid) interrupt();
                        break;
                    case 15:
                        this.kill();
                        if (c_task.pid === this.pid) interrupt();
                        break;
                }
                this.waiting = false;
                this.unfreeze();
            }
            capture(signum, handler) {
                this.sigoverrides[signum] = handler;
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
                // Kill siblings
                for(let t of this.siblings)
                    if(!t.dead)
                        t.dead = true;
                check_dead_tasks();
            }
            get_cpu_time(){
                const time = get_time(3);
                return time - this.time_created - this.waited
            }
            run(time) {
                this.exec_time = time;
                this.initialized = true;
                this.run_ctx(this.handler, is_async(this.handler), () => {
                    if(!this.initialized) // Prevent killing on finished execution if the process has been reinitialized with a new executable
                        this.die();
                });
            }
            run_ctx(_exec, useasync, after) {
                let onerror = e => {
                    if (!is_interrupt(e)) {
                        console.error(`[${get_uptime()}]: ` + this.cmdline + " (" + this.pid + ") encountered an error");
                        console.error(`Context: PID: ${c_task.pid}, user: ${c_task.user}`);
                        console.error(e);
                        try {
                            fprintf(stderr, this.command + ": " + e.message + "\n");
                        } catch (e) {
                            kwarn("No stderr");
                        }
                        this.kill();
                    }
                }
                if(useasync) {
                    (async () => {
                        // Set system context
                        c_task = this;

                        try {
                            await _exec(...this.args);
                        } catch (e) {
                            onerror(e);
                        }
                        after();
                    })()
                } else {
                    c_task = this;

                    try {
                        _exec(...this.args);
                    } catch (e) {
                        onerror(e);
                    }
                    after();
                }
            }
            // A sibling is basically just another word for thread
            // Siblings share descriptors and sigoverrides and children (and code).
            create_sibling(handler, args) {
                let t = new Task(this.user, this.working_path, this.cmdline, this.code, handler, pids++, args);
                t.descriptor_table = this.descriptor_table;
                t.children = this.children;
                t.sigoverrides = this.sigoverrides;
                t.parent_pid = this.parent_pid;
                t.is_main = false;

                t.siblings = this.siblings;
                t.siblings.push(this);
                
                tasks.push(t);
                t.run(get_time(3));
                return t;
            }
            // If we want to kill one process, we want to kill all siblings too becuase they are undesired
            die() {
                if(this.is_main)
                    this.kill();
                else {
                    this.dead = true;
                    check_dead_tasks();
                }
            }
        }
        let get_task = function (pid) {
            for (let task of tasks)
                if (task.pid === pid) return task;
        }
        let get_task_index = function (pid) {
            for(let i = 0; i < tasks.length; i++)
                if(tasks[i].pid === pid) return i;
        }
        let asyncwait = function(handler) {
            let task = c_task;

            const time = get_time(3);

            let post_wait = () => {
                task.waited += get_time(3) - time;
                c_task = task;
            }
            if(task.waiting) {
                let unfreeze = task.unfreeze;
                return new Promise(a => {
                    task.unfreeze = () => {
                        // unfreeze();
                        a();
                    }
                }).then(post_wait);
            }
            // If the task is dead, we make the promise unresolvable to prevent further execution.
            if(task.dead) {
                return new Promise(a => {});
            }

            return new Promise(resolve => {
                handler(resolve);
            }).then(post_wait);
        }
        getpid = syscall(function () {
            return c_task.pid;
        });
        getuid = syscall(function () {
            return c_task.user;
        });
        getexe = syscall(function () {
            return c_task.cmdline;
        })
        fork = syscall(function (intermediate_code) {
            if (!c_task) panic("Fork was run outside of kernel context");
            let t = c_task.clone(intermediate_code);
            return t.pid;
        });
        wait = syscall(async function () {
            if (!c_task) panic("wait() was run outside of kernel context");
            c_task.waiting = true;
            return asyncwait();
        });
        exec = syscall(function (path, ...args) {
            let file = get_file(path);
            if (file.incomplete) throw new Error("File at " + path + " does not exist.");
            let code_object = file.inode.get_data();
            let code = new code_object();

            c_task.code = code;
            c_task.cmdline = path;
            c_task.command = get_filename(path);
            c_task.handler = code.main;
            c_task.args = args;

            c_task.initialized = false;
            c_task.run(get_time(3));
            interrupt();
        });
        thread = syscall(function (handler, args) {
            return c_task.create_sibling(handler, args);
        });
        cancel = syscall(function (pid) {
            get_task(pid).die();
        });
        sleep = syscall(async function (time) {
            let task = c_task;
            return asyncwait(a => setTimeout(() => {
                if(!task.dead)
                    a();
            }, time))
        });
        exit = syscall(function () {
            c_task.kill();
            interrupt();
        });
        kill = syscall(function (pid, sig) {
            let task = get_task(pid)
            if (!task) throw new Error("No process with PID " + pid);
            task.signal(sig);
        });
        signal = syscall(function (signum, handler) {
            c_task.capture(signum, handler);
        });
        getppid = syscall(function () {
            let parent = c_task.parent;
            if (!parent) throw new Error("Process does not have a parent.")
            return parent.pid;
        });
        chdir = syscall(function (path) {
            let new_working_path = full_path(path);
            if (!access(new_working_path))
                throw new Error(new_working_path + " does not exist.");
            return c_task.working_path = new_working_path;
        });
        getcwd = syscall(function () {
            return c_task.working_path;
        });

        // Passive Task Management
        function check_dead_tasks() {
            for (let i = 0; i < tasks.length; i++) {
                let task = tasks[i];
                if (task.dead) {
                    for(let j = 0; j < task.siblings.length; j++)
                        if(task.siblings[j].pid === task.pid)
                            task.siblings.splice(j, 1);
                    tasks.splice(i, 1);
                    if(task.siblings.length === 0) // If all siblings (threads) are dead
                        task.parent.signal(20);
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
        // Because this project sucks, in order to do literally any sort of FS operation, a dummy task has to be created.
        c_task = new Task(0, "/", "kernel", null ,() => {this.main=() => wait();}, 0, []);

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
            tasks.push(new Task(0, "/", "preinit", init_code, init_code.main, 1, []));
        }
        function run_init() {
            tasks[0].run();
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
            for(let t of tasks)
                t.kill(); // Kill all tasks
            purge();
        }
        function purge() {
            tasks = [];
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
                        // Kernel stasis: keep kernel alive with no tasks (including no init)
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
                tasks: tasks.length,

            }
        })

        // Usage counters
        function get_user_time() {
            let t = 0;
            const time = get_time(3);
            for(let task of tasks) {
                t += time - task.time_created - task.waited;
            }
            return t;
        }
    }
}