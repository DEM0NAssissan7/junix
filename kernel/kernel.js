/* First order of business: create filesystem architecture & APIs */

{
    // Mounting
    let mount_table = [];
    let mount_fs = function(filesystem, path) {
        filesystem.mount(path);
        mount_table.push(filesystem);
    }
    function mount(device, path) {
        let fs = get_file(device).inode.get_data();
        mount_fs(fs, path);
    }
    function umount(path) {

    }

    // Root
    let root_fs;
    let mount_root = function(filesystem) {
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
            if(inode.type !== "d") return inode;
            let success = false;

            let data = inode.get_data();
            let path_name = path_names[name_index];
            for(let _index of data) {
                let _inode = filesystem.get_inode(_index);
                if(_inode.filename === path_name) {
                    success = true;
                    inode = _inode;
                    if(_inode.mountpoint === true) {
                        filesystem = mount_table[_inode.data];
                        index = 0
                        inode = filesystem.get_inode(index);
                    }
                    if(_inode.type === "s") return get_file(_inode.get_data());
                }
            }
            if(!success) break;
            name_index++;
            steps--;
        }

        return {
            filesystem: filesystem,
            inode: inode,
            incomplete: steps === 0
        };
    }
    
    // Process
    let processes = [];
    let pids = 0;
    let c_process, c_user;
    class Thread {
        constructor(process, exec, pid) {
            this.exec = exec;
            this.pid = pid;
            this.sleep = 0;
            this.last_exec = get_time();
        }
        is_ready(time) {
            if(time >= get_time() + this.sleep)
                return true;
            return false;
        }
        run() {
            this.last_exec = get_time();
            this.exec();
        }
    }
    class Process {
        constructor(code_object, user) {
            this.descriptor_table = [
                new FileDescriptor("", "-", 755, user), // Stdin
                new FileDescriptor("", "-", 755, user) // Stdout
            ];
            this.descriptors = 2;

            this.pid = pids;
            this.user = user;
            this.code = code_object; // Pass in code object, must already be created from 'new' statment beforehand
            this.threads = [];
            this.add_thread(this.code.main);
        }
        exec(code) {
            this.code = code; // Replace process code object with exec
            this.threads = [
                new Thread(this, this.code.main, this.pid)
            ]
        }
        add_thread(exec) {
            this.threads.push(this, exec, pids++);
        }
        create_descriptor(descriptor) {
            this.descriptor_table.push(descriptor);
            return this.descriptors++;
        }
        get_descriptor(fd) {
            let inode = this.descriptor_table[fd];
            if(!inode) throw new Error("No descriptor at " + fd);
            return inode;
        }
        close(fd) {
            if(!this.descriptor_table[fd]) throw new Error("No file descriptor at " + fd);
            this.descriptor_table.splice(fd, 1);
        }
    }
    function getpid() {
        return c_process.pid;
    }
    function fork() {
        let process = new Process(c_process.code, c_user);
        processes.push(process);
        return process.pid;
    }
    function exec(path) {
        let code = new get_file(path).inode.get_data()();
        c_process.exec(code);
    }
    function thread(exec) {
        c_process.add_thread(exec);
    }

    // Init process
    {
        let init_code = new function() {
            this.main = function() {
                exec("/bin/init");
            }
        }
        processes.push(new Process(init_code));
    }

    // Descriptors
    let descriptor_table = [];
    let descriptors = 0;
    class FileDescriptor{ 
        constructor(data, flags, mode, user, inode) {
            this.data = data;
            this.flags = flags;
            this.mode = mode;
            this.user = user;
            this.inode = inode;
            this.buffer = data;
            this.events = [];
        }
        write(data) {
            this.buffer = data;
        }
        append(data) {
            this.buffer =+ data;
        }
        flush() {
            this.inode.write(this.buffer);
        }
    }
    function fopen(path, flags, mode) {
        // Create and return a file descriptor for a file
        if(!mode) throw new Error("No mode specified");
        let inode = get_file(path).inode;

        let descriptor = new FileDescriptor(inode.get_data(), flags, inode.mode);
        return c_process.create_descriptor(descriptor);
    }
    function read(fd) {
        return c_process.get_descriptor(fd).data;
    }
    function write(fd, data) {
        let descriptor = c_process.get_descriptor(fd);
        switch(descriptor.flags) {
            case 'r':
                throw new Error("Cannot write to a file descriptor opened as readonly");
            case 'w':
                descriptor.data = data;
                break;
            case 'a':
                descriptor.data += data;
                break;
        }
    }
    function close(fd) {
        fd.flush();
        c_process.close(fd);
    }

    // Scheduler
    let scheduler = function() {
        for(let i = 0; i < processes.length; i++) {
            let process = processes[i];
            process
        }
    }
}