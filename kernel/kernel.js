/* JUNIX Kernel: The heart of the operating system

Main objectives:
- Be as absolutely minimal as possible - leave everything except the bare essentials to servers
- Microkernel-like architecture
- Behave as close as possible to a real UNIX-like OS (e.g. syscall names and behaviors)
*/



/* First order of business: create filesystem architecture & APIs */

let errno;
{
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

    //Panic
    let panic = function(message) {
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
        read() {
            if(this.inode)
                this.buffer = this.inode.get_data(); // Update buffer
            return this.buffer;
        }
        listdir() {
            if(this.filetype !== "d") throw new Error("Cannot execute listdir(): not a directory");
            console.log(this.buffer)
            let names = [];
            for(let i of this.buffer)
                names.push(this.filesystem.get_inode(i).filename);
            return names;
        }
        write(data) {
            if(this.filetype !== "-") throw new Error("Cannot write to a non-normal file");
            this.buffer = data;
            this.flush();
        }
        append(data) {
            this.write(this.buffer + data);
        }
        flush() {
            if(this.inode)
                this.inode.write(this.buffer);
        }
    }
    function fopen(path, flags, mode) {
        // Create and return a file descriptor for a file
        if(!path) throw new Error("You must specify a path");
        if(!flags) throw new Error("No flags specified");

        let file = get_file(path);
        let inode = file.inode;
        if(file.incomplete) {
            kdebug("Creating file at " + path);
            inode = file.filesystem.create_file(inode.index, path, "", "-", c_user, mode ?? inode.mode);
        }

        let descriptor = new FileDescriptor(inode.get_data(), flags, inode.mode, c_user, inode, file.filesystem);
        return c_process.create_descriptor(descriptor);
    }
    function read(fd) {
        return c_process.get_descriptor(fd).read();
    }
    function write(fd, data) {
        let descriptor = c_process.get_descriptor(fd);
        switch(descriptor.flags) {
            case 'r':
                console.log(descriptor.flags)
                throw new Error("Cannot write to a file descriptor opened as readonly");
            case 'w':
                descriptor.write(data);
                break;
            case 'a':
                descriptor.append(data);
                break;
        }
    }
    function dup(fd) {
        c_process.duplicate(fd);
    }
    function fclose(fd) {
        let descriptor = c_process.get_descriptor(fd);
        descriptor.flush();
        c_process.close(fd);
    }
    function mkdir(path) {
        let file = get_file(path);
        if(file.incomplete)
            file.filesystem.create_file(file.inode.index, path, [], "d", c_user, file.inode.mode);
    }
    function opendir(path) {
        let file = get_file(path);
        if(file.incomplete) throw new Error("Directory " + path + " does not exist");
        if(file.inode.type !== "d") throw new Error("opendir() failed: not a directory [" + path + "]");
        let descriptor = new FileDescriptor(file.inode.get_data(), "r", 755, c_user, file.inode, file.filesystem);
        return c_process.create_descriptor(descriptor);
    }
    function listdir(fd) {
        return c_process.get_descriptor(fd).listdir();
    }
    function closedir(fd) {
        let descriptor = c_process.get_descriptor(fd);
        c_process.close(descriptor);
    }

    // Mounting
    let mount_table = [];
    let mount_fs = function(filesystem, path) {
        let file = get_file(path);
        file.inode.mount(mount_table.length);
        filesystem.mount(mount_table.length, file.inode);
        mount_table.push(filesystem);
    }
    function mount(device, path) {
        let file = get_file(device);
        if(file.incomplete) throw new Error("Device does not exist at " + device)
        let fs = file.inode.get_data();
        mount_fs(fs, path);
        kdebug("Device " + full_path(device) + " mounted at " + full_path(path));
    }
    function umount(path) {
        let file = get_file(path);
        if(file.incomplete) throw new Error("File does not exist at " + path);
        let inode = file.inode;
        if(file.type === "m") {
            mount_table[inode.mountpoint] = null
            inode.get_data().parent_inode.umount();
        }
        if(file.type === "d") {
            mount_table[inode.mountpoint] = null
            inode.get_data().umount();
        }
        return 0;
    }

    // Kernel file tools
    let working_path = "/";
    let full_path = function(path) {
        let input_paths = map_path_names(path);
        let working_paths = map_path_names(working_path);
        let paths = working_paths.concat(input_paths);
        return consolidate_path_names(paths);
    }
    let get_file = function(path) {
        if(!path) throw new Error("No path specified");
        let path_names = map_path_names(full_path(path));
        let filesystem = root_fs;
        let index = 0;
        let inode;
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

    // Interrupts
    const interrupt_string = "interrupt"
    let interrupt = function() {
        throw interrupt_string;
    }
    let is_interrupt = function(string) {
        if(string === interrupt_string) return true;
        return false;
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
            if(this.sleep < 0) return 0;
            if(time >= this.last_exec + this.sleep)
                return true;
            return false;
        }
        run() {
            this.exec(...this.args);
        }
    }
    class Process {
        constructor(code_object, user, working_path) {
            this.descriptor_table = [
                new FileDescriptor("", "a", 755, user), // Stdin
                new FileDescriptor("", "a", 755, user), // Stdout
                new FileDescriptor("", "a", 755, user) // Stderr
            ];
            this.descriptors = 3;

            this.cmdline = null;
            this.command = null;
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
        clone() {
            let code = Object.assign(Object.create(Object.getPrototypeOf(this.code)), this.code); // Clone the process running code
            let process = new Process(code, this.user);
            this.children.push(process);
            process.cmdline = this.cmdline;
            process.command = this.command;
            process.parent = this;
            process.child_index = this.children.length - 1;
            process.descriptor_table = this.descriptor_table
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
            this.threads.push(new Thread(this, exec, pids++, args));
        }
        create_descriptor(descriptor) {
            this.descriptor_table.push(descriptor);
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
            for(let i = 0; i <= this.descriptor_table.length; i++) {
                if(!this.descriptor_table[i]) {
                    this.descriptor_table[i] = this.get_descriptor(fd);
                    return i;
                }
            }
            throw new Error("Could not duplicate process: unknown error");
        }
        signal(code) {
            switch(code) {
                case 9:
                    this.dead = true;
                    if(c_process.pid === this.pid) interrupt();
                    break;
            }
            this.code_table
        }
    }
    function getpid() {
        return c_process.pid;
    }
    function fork() {
        if(!c_process) panic("Fork was run outside of kernel context");
        let process = c_process.clone();
        processes.push(process);
        return process.pid;
    }
    function exec(path, args) {
        let file = get_file(path);
        if(file.incomplete) throw new Error("File at " + path + " does not exist.");
        let code_object = file.inode.get_data();
        let code = new code_object();
        c_process.exec(code, args ?? [], full_path(path));
    }
    function thread(exec, args) {
        c_process.add_thread(exec, args);
    }
    function sleep(time) {
        c_thread.sleep = time;
    }
    function exit() {
        c_process.dead = true;
        interrupt();
    }
    function getpid() {
        return c_process.pid;
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
                        thread.process.suspended = true;
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
    kdebug("Mounting temporary rootfs");
    mount_root(new JFS());
    
    /* Kernel-level device management */
    let devfs = new JFS();
    mkdir("/dev");
    mount_fs(devfs, "/dev");

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
    window.root_fs = root_fs;

    // Init process
    {
        kdebug("Creating init");
        let init_code = new function() {
            this.main = function() {
                kdebug("Running init");
                exec("/bin/init");
            }
        }
        processes.push(new Process(init_code, 0));
    }

    // Execution loop
    kdebug("Beginning execution loop");
    setInterval(() => {
        scheduler();
    }, 100);
    setTimeout(() => {
        console.log(get_file("/bin"))
    }, 100);
}