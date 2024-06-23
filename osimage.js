/* libraries/mawi.js */
function deep_obj(object) {
    return JSON.parse(JSON.stringify(object));
    // return object;
}

{
    let time = performance.now();
    function get_time(accuracy) {
        let a = accuracy ?? 1;
        return Math.round((performance.now() - time) * a) / a;
    }
}
let map_path_names = function (path) {
    let file_string = "";
    let string_list = [];
    if(!path) throw new Error("Invalid path");
    for (let i = 0; i < path.length; i++) {
        let char = path[i];
        switch (char) {
            case "/":
                if (file_string.length !== 0)
                    string_list.push(file_string);
                file_string = "";
                continue;
            case ".":
                if (i === path.length - 1) continue;
                switch (path[i + 1]) {
                    case ".":
                        if (path[i + 2] === "/") {
                            string_list.splice(string_list.length - 1, 1);
                            i += 2;
                        }
                        break;
                    case "/":
                        i++;
                        continue;
                }
                break;
        }
        file_string += char;
    }
    if (file_string.length !== 0)
        string_list.push(file_string);
    return string_list;
}
let consolidate_path_names = function(path_names) {
    let retval = "";
    for(let name of path_names)
        retval += "/" + name;
    return retval;
}
let get_filename = function(path) {
    let filename = "";
    for (let i = 0; i < path.length; i++) {
        let char = path[i];
        if (char === "/") {
            filename = "";
            continue;
        }
        filename += char;
    }
    if(filename.length !== 0) return filename;
    return path;
}
let to_string = function(data) {
    let type = typeof data;
    if(type === "function")
        return data.toString();
    else return JSON.stringify(data);
}
let data_size = function(data) {
    return (new TextEncoder().encode(to_string(data))).length
}
let clear_cookies = function() {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}

// Encoding and decoding
let encode = function(uncoded_string, code) {
    let output_string = "";
    for(let i = 0; i < uncoded_string.length; i++) {
        let has_encoding = false;
        for(let j = 0; j < code.length; j++) {
            if(uncoded_string[i] === code[j][0]) {
                output_string += code[j][1];
                has_encoding = true;
                break;
            }
        }
        if(!has_encoding) output_string += uncoded_string[i];
    }
    return output_string;
}
let decode = function(coded_string, code) {
    let output_string = "";
    for(let i = 0; i < coded_string.length; i++) {
        let has_encoding = false;
        for(let j = 0; j < code.length; j++) {
            if(coded_string[i] === code[j][1]) {
                output_string += code[j][0];
                has_encoding = true;
                break;
            }
        }
        if(!has_encoding) output_string += coded_string[i];
    }
    return output_string;
}
/* libraries/stdlib.js */
function fprintf(message, fd) {
    write(fd, message);
}
function printf(message) {
    fprintf(message, 1);
}
function fgetc() {
    let string = read(fd);
    if(string.length > 0) return string;
    return false;
}
/* kernel/filesystem.js */
class Inode {
    constructor(index, path, data, type, user, mode) {
        this.index = index;
        this.path = path;
        this.data = data;
        let filename = get_filename(path);
        if(filename.length !== 0) this.filename = filename;    
        this.type = type;
        this.user = user;
        this.mode = mode;
        this.mountpoint = false;
    }
    get_data() {
        return this.data;
    }
    mount(index) {
        this.mountpoint = index;
    }
    umount() {
        this.mountpoint = false;
    }
    write(data) {
        if(this.type === "-") {
            this.data = data;
        } else
            throw new Error("Cannot write data to a non-normal file.");
    }
    append(data) {
        if(this.type === "-") {
            this.data += data;
        } else
            throw new Error("Cannot write data to a non-normal file.");
    }
    add_directory_entry(data) {
        if(this.type !== "d") throw new Error("File must be type 'd' in order to add directory entries")
        this.data.push(data);
    }
    remove_directory_entry(index) {
        let target_index = this.data.indexOf(index);
        if(target_index === -1) throw new Error("Directory entry not found (target inode reference: " + index + ")");
        this.data.splice(target_index, 1);
    }
}

class JFS {
    constructor (options) {
        this.root = new Inode(0, "/", [], "d", 0, 111);
        this.inodes = [this.root];
        this.indexes = 1;
        this.mountpoint = false;
        this.casefold = true;
        if(options) {
            this.casefold = options.casefold ?? true;
        }
    }
    create_file(parent_index, path, data, type, user, mode) {
        let parent_inode = this.get_inode(parent_index);
        let inode = new Inode(this.indexes, path, data, type, user, mode);
        this.inodes.push(inode);
        parent_inode.add_directory_entry(this.indexes++);
        return inode;
    }
    get_inode(index) {
        let inode = this.inodes[index];
        if(!inode) throw new Error("No file exists at index " + index);
        return inode;
    }
    mount(index, inode) {
        this.mountpoint = index;
        this.parent_inode = inode;
    }
    stringify() {
        return "";
    }
    parse(string) {
        return "";
    }
}
/* fsbuild.js */
let initfs_table = [];

let mkfile = function(path, data) {
    if(!path) throw new Error("Must pass a path.");
    if(data)
        initfs_table.push([path, data]);
    else if(!data)
        initfs_table.push([path]);
}
mkfile('/usr');
mkfile('/usr/local');
mkfile('/usr/bin');
mkfile('/usr/bin/mklclstr',function(){
// Make local storage

this.main = function(args) {
    
}
});
mkfile('/home');
mkfile('/var');
mkfile('/var/modalias',function(){

});
mkfile('/etc');
mkfile('/etc/fstab',`/dev/disk0 /home`);
mkfile('/etc/rc',`/service/disk
/service/mount
/service/keyboard
/service/console
/bin/sh`);
mkfile('/boot');
mkfile('/boot/kernel',function(){
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
});
mkfile('/service');
mkfile('/service/serial',function(){
this.main = function() {

}
});
mkfile('/service/mount',function(){
this.main = function() {
    // Mount permanent storage
    mount("/dev/disk0", "/home");
    exit();
}
});
mkfile('/service/keyboard',function(){
let fd;
let keys = "";

function keyupdate() {
    write(fd, keys);
}
this.main = function() {
    fd = fopen("/dev/keyboard", "w", 777);
    thread(keyupdate, []);
    sleep(-1);
}

document.addEventListener("keydown", (e) => {
    keys+=e.key;
});

document.addEventListener("keyup", (e) => {
    keys = keys.replaceAll(e.key, "");
});
});
mkfile('/service/disk',function(){
let disks = 0;
let fd;
this.main = function() {
    try {
        let string, fd, fs;
        for(let i = 0; i < localStorage.length; i++) {
            string = localStorage.getItem("disk" + i);
            if(string == null) break;
            fs = new JFS();
            fs.parse(string);
            console.log(fd);
            fd = fopen("/dev/disk" + disks++, "w");
            console.log(read(fd), fd);
            write(fd, fs);
            fclose(fd);
        }
        if(localStorage.length === 0) throw "Needs initialization";
        console.log("On-device storage has been mapped", disks);
    } catch (e) {
        console.log(e);
        create_disk();
        console.log("On-device storage initialized");
    }
    fd = fopen("/dev/localstorage", "w");
    sleep(-1);
    thread(call_watcher, []);
}
function create_disk() {
    let fs = new JFS();
    localStorage.setItem("disk" + disks, "");
    let _fd = fopen("/dev/disk" + disks, "w");
    write(_fd, fs);
    fclose(_fd);
    console.log("Created /dev/disk" + disks++);
}
let input;
function call_watcher() {
    input = read(fd);
    if(input.length > 0) {
        if(input == "c") {
            create_disk();
        }
    }
    write(fd, "");
    sleep(10);
}
});
mkfile('/service/console',function(){
let fd, element;
let update_display = function() {
    let string = read(fd);
    let buff = element.innerText;
    let char;
    for(let i = 0; i < string.length; i++) {
        char = string[i];
        console.log(char);
        switch(char) {
            case "\b":
                buff = buff.substring(0, buff.length - 1);
                break;
            default:
                buff += char;
                break;
        }
    }
    element.innerText = buff
    write(fd, "");
    sleep(5);
}
this.main = function() {
    element = document.getElementById("console");
    fd = fopen("/dev/console", "w");
    sleep(-1);
    thread(update_display, []);
}
});
mkfile('/bin');
mkfile('/bin/modload',function(){
// This program is responsible for detecting and initializing drivers for all hardware attached at all times

this.main() = () => {
}
});
mkfile('/bin/init',function(){
// JUNIX Init system: inspired by FreeBSD rc
this.main = () => {
    let fd = fopen("/etc/rc", "r");
    let paths = read(fd).split("\n");
    for(let path of paths)
        this.open(path);
    sleep(-1);
}
this.open = function(path) {
    console.log("Initializing " + path)
    exec(path);
    fork();
}
});
mkfile('/bin/sh',function(){
let command = "";
let prompt = "#";
this.main = function(...args) {
    let child = false;
    for(let arg of args) {
        if(arg === "child=true") {
            child = true;
            break;
        }
    }
    if(!child) {
        // Set stdin and stout as /dev/keyboard and /dev/console
        fclose(0);
        fclose(1);
        fclose(2);

        let fd = fopen("/dev/keyboard", "r");
        dup(fd);
        fclose(fd);
        fd = fopen("/dev/console", "w");
        dup(fd);
        dup(fd);
        fclose(fd);
    }
    sleep(-1);
    thread(read_input, []);
    thread(blink_cursor, []);
}

function read_input() {
    let b = read(0);
    printf(read(0));
}
let on = false;
function blink_cursor() {
    if(!on)
        set_cursor_on();
    else
        set_cursor_off();

    sleep(2000);
}
function set_cursor_off() {
    if(on) {
        del();
        on = false;
    }
}
function set_cursor_on() {
    if(!on) {
        printf("█");
        on = true;
    }
}

function write_string(string) {
    let fd = fopen("/dev/console", "a")
    write(fd, string);
    fclose(fd)
}

function del(count) {
    let string = "";
    for(let i = 0; i < count ?? 1; i++) {
        string += "\b"
    }
    write_string("\b");
}
});
/* boot.js */
let kargs = {
    initfs_table: initfs_table,
}
/* kernel/kernel.js */
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
