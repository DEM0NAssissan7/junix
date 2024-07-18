/* JUNIX Kernel: The heart of the operating system

Main objectives:
- Be as absolutely minimal as possible - leave everything except the bare essentials to servers
- Microkernel-like architecture
- Behave as close as possible to a real UNIX-like OS (e.g. syscall names and behaviors)
*/


/* Syscall definitions

In order for programs to properly be able to call systemcalls, the variable scope needs to be outside the kernel function context.


Syscall sections:
*/

/* File management */

var fopen; // Create a new file descriptor from inode path; if file doesn't exist, make a new one
var read; // Read data from file descriptor
var write; // Write data to file descriptor
var access; // Check if file exists
var dup; // Duplicate file descriptor
var fclose; // Close file descriptor

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

/* Kernel Code */

let errno;
{
    let entered = false;
    function kernel_entry(kargs) {
        // Check if previously entered
        if(entered)
            throw new Error("Cannot execute kernel: already entered.");
        entered = true;

        // Logging
        const print_klog = true;
        let klog = [];
        let create_log_entry = function(message, severity) {
            let time = get_time();
            klog.push({
                message: message,
                time: time,
                severity: severity
            });
            if(print_klog) {
                const prefix = "[" + time + "] ";
                switch(severity) {
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
        let kdebug = function(message) {
            create_log_entry(message, 0);
        }
        let kwarn = function(message) {
            create_log_entry(message, 1);
        }
        let kerror = function(message) {
            create_log_entry(message, 2);
        }
        kdebug("Entered kernel");

        //Panic
        let interval;
        let panic = function(message) {
            clearInterval(interval);
            alert("Panic! -> " + message);
            console.error("Kernel panic (" + get_time() + ")");
            console.error(message);
            kerror("Kernel panic: " + message);
            throw new Error("Panic!");
        }

        // Kernel Arguments
        if(!kargs)
            kwarn("No kernel arguments specified. Running kernel headless.");

        // Descriptors
        class FileDescriptor{ 
            constructor(data, flags, mode, user, inode, filesystem) {
                this.data = data;
                this.flags = flags;
                this.mode = mode;
                this.user = user;
                this.inode = inode;
                this.filesystem = filesystem;
                if(inode)
                    this.filetype = inode.type;
                this.buffer = data;
                this.events = [];
            }
            update_buffer() {
                if(this.inode)
                    this.buffer = this.inode.get_data();
            }
            read() {
                if(this.filetype === "d") throw new Error("cannot read: is a directory");
                this.update_buffer();
                return this.buffer;
            }
            listdir() {
                if(this.filetype !== "d") throw new Error("Cannot execute listdir(): not a directory");
                let names = [];
                for(let i of this.buffer)
                    names.push(this.filesystem.get_inode(i).filename);
                return names;
            }
            write(data) {
                if(this.filetype !== "-" && this.filetype) throw new Error("Cannot write to a non-normal file");
                this.buffer = data;
                this.flush();
            }
            append(data) {
                this.update_buffer();
                this.write(this.buffer + data);
            }
            flush() {
                if(this.inode)
                    this.inode.write(this.buffer);
            }
        }
        fopen = function(path, flags, mode) {
            // Create and return a file descriptor for a file
            if(!path) throw new Error("You must specify a path");
            if(!flags) throw new Error("No flags specified");

            let file = get_file(path);
            let inode = file.inode;
            if(file.incomplete) {
                if(flags === "r") throw new Error("File " + path + " does not exist");
                kdebug("Creating file at " + path);
                inode = file.filesystem.create_file(inode.index, path, "", "-", c_user, mode ?? inode.mode);
            }

            let descriptor = new FileDescriptor(inode.get_data(), flags, inode.mode, c_user, inode, file.filesystem);
            return c_process.create_descriptor(descriptor);
        }
        read = function(fd) {
            return c_process.get_descriptor(fd).read();
        }
        write = function(fd, data) {
            let descriptor = c_process.get_descriptor(fd);
            switch(descriptor.flags) {
                case 'r':
                    throw new Error("Cannot write to a file descriptor opened as readonly");
                case 'w':
                    descriptor.write(data);
                    break;
                case 'a':
                    descriptor.append(data);
                    break;
            }
        }
        access = function(path) {
            return !(get_file(path).incomplete);
        }
        dup = function(fd) {
            c_process.duplicate(fd);
        }
        fclose = function(fd) {
            let descriptor = c_process.get_descriptor(fd);
            descriptor.flush();
            c_process.close(fd);
        }
        mkdir = function(path) {
            let file = get_file(path);
            if(file.incomplete)
                file.filesystem.create_file(file.inode.index, path, [], "d", c_user, file.inode.mode);
        }
        opendir = function(path) {
            let file = get_file(path);
            if(file.incomplete) throw new Error("Directory " + path + " does not exist");
            if(file.inode.type !== "d") throw new Error("opendir() failed: not a directory [" + path + "]");
            let descriptor = new FileDescriptor(file.inode.get_data(), "r", 755, c_user, file.inode, file.filesystem);
            return c_process.create_descriptor(descriptor);
        }
        listdir = function(fd) {
            return c_process.get_descriptor(fd).listdir();
        }
        closedir = function(fd) {
            let descriptor = c_process.get_descriptor(fd);
            c_process.close(descriptor);
        }
        dirname = function(path) {
            return full_path(path);
        }

        // Mounting
        let mount_table = [];
        let mount_fs = function(filesystem, path) {
            let file = get_file(path);
            if(file.incomplete) throw new Error("Cannot mount at " + path + ": directory does not exist");
            if(file.inode.type !== "d") throw new Error("Cannot mount at " + path + ": not a directory");
            if(typeof filesystem !== "object") throw new Error("Cannot mount filesystem: not an object");
            if(filesystem.magic !== 20) throw new Error("Mount failed: not a filesystem");
            // Check if the filesystem already exists in the mount table
            for(let fs of mount_table) {
                if(!fs) continue;
                if(fs.uuid === filesystem.uuid)
                    throw new Error("Mount failed: Filesystem already exists in mount table.");
            }

            file.inode.mount(mount_table.length);
            filesystem.mount(mount_table.length, file.inode);
            mount_table.push(filesystem);
        }
        mount = function(device, path) {
            let file = get_file(device);
            if(file.incomplete) throw new Error("Device does not exist at " + device)
            let fs = file.inode.get_data();
            mount_fs(fs, path);
            kdebug("Device " + full_path(device) + " mounted at " + full_path(path));
        }
        let unmount_fs = function(filesystem) {
            if(!filesystem || typeof filesystem !== "object") throw new Error("Filesystem invalid");
            if(filesystem.mountpoint === false) throw new Error("Cannot unmount filesystem: not mounted");
            let inode = filesystem.parent_inode;

            if(inode.mountpoint === false) throw new Error("Cannot unmount filesystem: ");
            filesystem.sync(); // Sync filesystem before unmounting
            mount_table[filesystem.mountpoint] = undefined;
            inode.mountpoint = false;
            filesystem.mountpoint = false;
            filesystem.root.mountpoint = false;
        }
        let unmount_all = function() {
            for(let fs of mount_table)
                if(fs && typeof fs === "object")
                    unmount_fs(fs);
        }
        umount = function(path) {
            let file = get_file(path);
            if(file.incomplete) throw new Error("File does not exist at " + path);
            let filesystem;
            if(file.inode.type === "d") {
                console.log(file.inode.mountpoint, file.inode.path)
                filesystem = mount_table[file.inode.mountpoint];
            }
            else if(typeof file.inode.get_data() === "object")
                filesystem = file.inode.get_data();
            unmount_fs(filesystem);
            return 0;
        }
        sync = function() {
            for(let fs of mount_table) {
                if(!fs) continue;
                fs.sync();
            }
        }

        // Kernel file tools
        let full_path_dirty = function(path) {
            if(path.length === 0) throw new Error("Invalid path");
            let working_path = "";
            if(path[0] !== "/") {
                working_path = "/";
                if(c_process)
                    working_path = c_process.working_path;
            }
            return working_path + "/" + path;
        }
        let map_full_path_names = function(path) {
            return map_path_names(full_path_dirty(path))
        }
        let full_path = function(path) {
            return consolidate_path_names(map_full_path_names(path));
        }
        let get_file = function(path) {
            if(!path) throw new Error("No path specified");
            let path_names = map_full_path_names(path);
            let filesystem = root_fs;
            let index = 0;
            let inode = filesystem.get_inode(index);
            let name_index = 0;

            let steps = path_names.length;
            while(steps > 0) {
                inode = filesystem.get_inode(index);
                if(inode.type === "l") return get_file(inode.get_data());
                if(inode.type !== "d") break;
                let success = false;

                let data = inode.get_data();
                let path_name = path_names[name_index];
                for(let _index of data) {
                    let _inode = filesystem.get_inode(_index);
                    if(_inode.filename === path_name) {
                        success = true;
                        index = _index;
                        inode = _inode;
                        if(_inode.mountpoint !== false) {
                            filesystem = mount_table[_inode.mountpoint];
                            index = 0;
                            inode = filesystem.get_inode(index);
                        }
                        break;
                    }
                }
                if(!success) break;
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
        let c_process, c_user;
        class Thread {
            constructor(process, exec, pid, args) {
                this.process = process;
                this.exec = exec;
                this.pid = pid;
                this.args = args ?? [];
                this.sleep = 0;
                this.queued = false;
                this.last_exec = get_time(3);
            }
            is_ready(time) {
                if(this.sleep < 0) return false;
                if(time >= this.last_exec + this.sleep)
                    return true;
                return false;
            }
            slept(time) {
                if(this.sleep === 0)
                    return false;
                return this.is_ready(time);
            }
            run() {
                this.exec(...this.args);
            }
        }
        class Process {
            constructor(code_object, user, working_path) {
                this.descriptor_table = [
                    new FileDescriptor("", "w", 777, 0),
                    new FileDescriptor("", "w", 777, 0),
                    new FileDescriptor("", "w", 777, 0)
                ];

                this.cmdline = null;
                this.command = null;
                this.waiting = false;
                this.suspended = false;
                this.dead = false;

                this.working_path = working_path;

                this.pid = pids;
                this.user = user;
                this.code = code_object; // Pass in code object, must already be created from 'new' statment beforehand
                this.children = [];
                this.child_index = 0;
                this.parent = this;
                this.threads = [];
                this.add_thread(this.code.main, []);

                this.code_table = [
                    //0
                ]
            }
            exec(code, args, path) {
                this.code = code; // Replace process code object with exec
                this.cmdline = path;
                this.command = get_filename(path);
                this.threads = [
                    new Thread(this, this.code.main, this.pid, args)
                ]
            }
            clone_descriptors() {
                let retval = [];
                for(let descriptor of this.descriptor_table) {
                    if(!descriptor) {
                        retval.push(undefined);
                        continue;
                    }
                    retval.push(new FileDescriptor(descriptor.data, descriptor.flags, descriptor.mode, descriptor.user, descriptor.inode, descriptor.filesystem));
                }
                return retval;
            }
            clone(intermediate_code) {
                let code = Object.assign(Object.create(Object.getPrototypeOf(this.code)), this.code); // Clone the process running code
                let process = new Process(code, this.user, this.working_path);
                this.children.push(process);
                process.cmdline = this.cmdline;
                process.command = this.command;
                process.parent = this;
                process.child_index = this.children.length - 1;
                process.descriptor_table = this.clone_descriptors();

                // Run intermediate code because javascript is unable to behave exactly like a real kernel
                if(intermediate_code) {
                    let _c_process = c_process;
                    let _c_thread = c_thread;
                    let _c_user = c_user;
                    c_process = process;
                    c_thread = process.get_thread(c_thread.pid);
                    c_user = process.user;
                    try {
                        intermediate_code();
                    } catch (e) {
                        this.signal(20);
                        throw new Error("Could not fork process: " + e)
                    }
                    c_process = _c_process;
                    c_thread = _c_thread;
                    c_user = _c_user;
                }
                return process;
            }
            is_available() {
                if( this.suspended ||
                    this.dead ||
                    this.waiting)
                    return false;
                return true;
            }
            add_thread(exec, args) {
                this.threads.push(new Thread(this, exec, pids, args));
                return pids++;
            }
            get_thread(pid) {
                for(let thread of this.threads) {
                    if(thread.pid === pid)
                        return thread;
                }
                return null;
            }
            cancel_thread(pid) {
                let thread = null;
                let i = 0;
                for(; i < this.threads.length; i++) {
                    if(this.threads[i].pid === pid) {
                        thread = this.threads[i];
                        break;
                    }
                }
                if(thread === null) throw new Error("Thread " + pid + " does not exist on this process");
                this.threads.splice(i, 1);
            }
            add_descriptor(descriptor) {
                for(let i = 0; i <= this.descriptor_table.length; i++) {
                    if(!this.descriptor_table[i]) {
                        this.descriptor_table[i] = descriptor;
                        return i;
                    }
                }
                return null;
            }
            create_descriptor(descriptor) {
                let r = this.add_descriptor(descriptor);
                if(r === null) throw new Error("Could not create file descriptor: unkown error")
                return this.descriptor_table.length - 1;
            }
            get_descriptor(fd) {
                let descriptor = this.descriptor_table[fd];
                if(!descriptor) throw new Error("No descriptor at " + fd);
                return descriptor;
            }
            close(fd) {
                if(!this.descriptor_table[fd]) throw new Error("No file descriptor at " + fd);
                this.descriptor_table[fd] = undefined;
            }
            duplicate(fd) {
                return this.add_descriptor(this.get_descriptor(fd))
            }
            signal(code) {
                switch(code) {
                    case 9:
                        this.kill();
                        if(c_process.pid === this.pid) interrupt();
                        break;
                    case 15:
                        this.kill();
                        if(c_process.pid === this.pid) interrupt();
                        break;
                }
                this.waiting = false;
            }
            kill() {
                for(let child of this.children) {
                    child.kill();
                }
                this.dead = true;
            }
            wait() {
                this.waiting = true;
            }
        }
        let get_process = function(pid) {
            for(let process of processes)
                if(process.pid === pid) return process;
        }
        getpid = function() {
            return c_process.pid;
        }
        fork = function(intermediate_code) {
            if(!c_process) panic("Fork was run outside of kernel context");
            let process = c_process.clone(intermediate_code);
            if(process)
                processes.push(process);
            else
                return -1;
            return process.pid;
        }
        wait = function() {
            if(!c_process) panic("wait() was run outside of kernel context");
            if(c_process.children.length !== 0)
                c_process.waiting = true;
            interrupt();
        }
        exec = function(path, ...args) {
            let file = get_file(path);
            if(file.incomplete) throw new Error("File at " + path + " does not exist.");
            let code_object = file.inode.get_data();
            let code = new code_object();
            c_process.exec(code, args ?? [], full_path(path));
        }
        thread = function(exec, args) {
            return c_process.add_thread(exec, args);
        }
        cancel = function(pid) {
            c_process.cancel_thread(pid);
        }
        sleep = function(time) {
            c_thread.sleep = time;
        }
        exit = function() {
            c_process.kill();
            interrupt();
        }
        kill = function(pid, sig) {
            let process = get_process(pid)
            if(!process) throw new Error("No process with PID " + pid);
            process.signal(sig);
        }
        getppid = function() {
            let parent = c_process.parent;
            if(!parent) throw new Error("Process does not have a parent.")
            return parent.pid;
        }
        chdir = function(path) {
            let new_working_path = full_path(path);
            if(!access(new_working_path))
                throw new Error(new_working_path + " does not exist.");
            return c_process.working_path = new_working_path;
        }
        getcwd = function() {
            return c_process.working_path;
        }

        // Scheduler
        const max_proc_time = 100;
        let threads = [];
        let scheduler = function() {
            const sched_start_time = get_time(3);
            // Load ready threads into buffer
            for(let i = 0; i < processes.length; i++) {
                let process = processes[i];
                if(process.is_available()) {
                    for(let j = 0; j < process.threads.length; j++) {
                        let thread = process.threads[j];
                        if(thread.is_ready(sched_start_time) && !thread.queued) {
                            threads.push(thread);
                            thread.queued = true;
                        }
                    }
                } else if(process.dead) {
                    processes.splice(i, 1);
                    process.parent.signal(20);
                    i--;
                    continue;
                }
            }
            // Run all queued threads
            while(threads.length > 0) {
                let thread = threads[0];
                c_process = thread.process;
                c_thread = thread;
                c_user = thread.process.user;
                let time = get_time(3);
                if(time - sched_start_time > max_proc_time) break;
                if(c_process.is_available()){
                    thread.last_exec = time;
                    try {
                        thread.run();
                    } catch (e) {
                        if(!is_interrupt(e)) {
                            console.error(thread.process.cmdline + " (" + thread.process.pid + ") encountered an error (thread: " + thread.pid + ")");
                            console.error(e);
                            fprintf(stderr, thread.process.command + ": " + e.message + "\n");
                            c_process.kill();
                        }
                    }
                }
                thread.queued = false;
                threads.splice(0, 1);
            }
            c_process = null;
            c_user = null;
            c_thread = null;
        }

        // Power manager: take advantage of dynamic kernel clocking
        let loop_timeout = 10;
        let dynamic_clock = function() {
            loop_timeout = 100;
            let earliest_exec_time = Infinity;
            let time = get_time(3);
            for(let process of processes) {
                if(process.is_available()) {
                    for(let thread of process.threads) {
                        if(thread.slept(time)) {
                            kernel_main();
                            kdebug("scheduler was early");
                        }
                        if(thread.sleep < earliest_exec_time && thread.sleep > 0)
                            earliest_exec_time = thread.sleep;
                    }
                }
            }
            if(earliest_exec_time !== Infinity)
                loop_timeout = earliest_exec_time
        }

        // Debug
        const debug = true;
        if(debug) {
            k_eval = function(string) {
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
        let root_fs;
        let mount_root = function(filesystem) {
            filesystem.mount("/");
            root_fs = filesystem;
        }
        kdebug("Mounting initrootf");
        mount_root(new JFS());
        
        /* Kernel-level device management */
        let devfs;
        let create_device_pointer = function(device, name) {
            devfs.create_file(0, "/dev/"+name, device, "-", 0, 511);
        }
        let create_devfs = function() {
            devfs = new JFS();
            mount_fs(devfs, "/dev");
            devfs.create_file
            create_device_pointer(devfs, "devfs");
            create_device_pointer(root_fs, "disk0");
        }
        mkdir("/dev");
        create_devfs();

        // Disk drivers

        /* 'rootfs_build' driver
        This should be the only driver that runs in kernel-mode */
        if(kargs.initfs_table) {
            (function() {
                kdebug("Building root filesystem from fs definition table");
                let table = kargs.initfs_table;
                for(let entry of table) {
                    if(entry.length === 1)
                        mkdir(entry[0]);
                    if(entry.length === 2) {
                        let file = get_file(entry[0]);
                        root_fs.create_file(file.inode.index, entry[0], entry[1], "-", 0, 711);        
                    }
                }
            })();
        } else if(kargs.fs_path) {
            kdebug("Mounting root from device map");
            mount(kargs.fs_path, "/");
        } else {
            kwarn("Kernel running headless. Tmpfs being used for root.");
        }
        root_fs = root_fs;

        // Init process
        function create_init(){
            kdebug("Creating init");
            let init_code = new function() {
                this.main = function() {
                    kdebug("Running init");
                    exec("/bin/init");
                }
            }
            processes.push(new Process(init_code, 0, "/"));
        }
        create_init();

        // System management
        let reset = function() {
            processes[0].kill(); // Kill all processes
            processes = [];
            threads = [];
            pids = 1;
            loop_timeout = 10;
        }
        function stop_kernel() {
            clearTimeout(kernel_timeout_id);
            loop_timeout = Infinity; // Prevent further execution
            entered = false; // Open the kernel to re-entry
        }
        reboot = function(op) {
            switch(op) {
                case 2: // Change op to be accurate to actual UNIX
                    kdebug("Soft rebooting system (without unmounting)...");
                    reset();
                    create_init();
                    break;
                case 3:
                    // Kernel re-entry (hard reboot)
                    kdebug("Rebooting...");
                    reset();
                    unmount_all();
                    entered = false;
                    kernel_entry(kargs); // Re-enter kernel with the same argument. This will completely reinitialize the system.
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
                    close();
                    break;
                case 6:
                    // Hard Boot (this basically acts like a bootloader that lives in memory)
                    kdebug("Hard Booting...");
                    kernel_entry(kargs);
                    break;
                case 7:
                    // Reinit
                    kdebug("Reinitializing system...");
                    create_devfs();
                    create_init();
                    break;
                case 8:
                    // Kernel stasis: keep kernel alive with no processes (including no init)
                    kdebug("Entering kernel stasis...");
                    reset();
                    unmount_all();
                    break;
                default:
                    throw new Error("opcode invalid");
            }
        }

        // Execution loop
        kdebug("Beginning execution loop");
        let kernel_main = () => {
            try {
                scheduler();
                dynamic_clock();
            } catch (e) {
                panic("Critical error in kernel.");
                console.error(e);
            }
        }
        let kernel_timeout_id;
        let kernel_loop = () => {
            kernel_main();
            kernel_timeout_id = setTimeout(kernel_loop, loop_timeout);
        }
        kernel_loop(); // Start execution
    }
}