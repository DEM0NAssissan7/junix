/* libraries/mawi.js */
// Interrupts
const interrupt_string = "interrupt"
let interrupt = function() {
    throw interrupt_string;
}
let is_interrupt = function(string) {
    if(string === interrupt_string) return true;
    return false;
}

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
                        if(path[i - 1]) {
                            if (path[i - 1] === "/") {
                                string_list.splice(string_list.length - 1, 1);
                                i += 2;
                                continue
                            }
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
    let retval = "/";
    for(let i = 0; i < path_names.length; i++) {
        retval += path_names[i];
        if(i < path_names.length - 1)
            retval += "/";
    }
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
function map_variables(string) {
    let buffer = "";
    let varname = "";
    let value = "";
    let deftable = [];
    for(let char of string) {
        switch(char) {
            case '=':
                if(varname.length > 0) {
                    value += buffer;
                    buffer = "";
                    break;
                }
                varname = buffer;
                buffer = "";
                break;
            case '\n':
                value += buffer;
                buffer = "";
                deftable.push([varname, value]);
                value = "";
                varname = "";
                break;
            default:
                buffer += char;
                break;
        }
    }
    if(buffer.length > 0)
        deftable.push([varname, buffer]);
    return deftable;
}
function map_env_vars(envp) {
    let deftable = [];
    for(let arg of envp) {
        let _deftable = map_variables(arg);
        if(_deftable.length < 1) continue;
        deftable.push(..._deftable);
    }
    return deftable;
}
function get_variable_value(identifier, deftable) {
    for(let def of deftable) {
        if(def[0] === identifier)
            return def[1];
    }
    return NaN;
}
function map_options(args) {

}

function random(min, max, accuracy) {
    let digits = Math.pow(10, accuracy ?? 0);
    return Math.floor(((Math.random() * max) * digits) / digits) + min
}
/* libraries/stdlib.js */
const stdin = 0;
const stdio = 1;
const stderr = 2;
function fprintf(fd, message) {
    write(fd, message);
}
function printf(...messages) {
    for(let message of messages)
        fprintf(stdio, message);
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
        if(this.mountpoint !== false) throw new Error("Cannot mount inode: already mounted.");
        this.mountpoint = index;
    }
    umount() {
        this.mountpoint = false;
    }
    write(data) {
        if(this.type === "-")
            this.data = data;
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
        this.magic = 20;
        this.uuid = random(0, 8196);
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
        if(this.mountpoint !== false) throw new Error("Cannot mount filesystem: already mounted");
        this.mountpoint = index;
        this.parent_inode = inode;
        this.root.mountpoint = index;
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
mkfile('/home');
mkfile('/usr');
mkfile('/usr/bin');
mkfile('/usr/bin/top',function(){
/* JUNIX top: performance monitor

Obviously, the top in this OS will work differently than one in an actual OS
It is measuring different things, such as the general clock of system (where FIFO takes place)

Processes are judged on percentage based on how often they run
The kernel needs to provide programs with a way to access this stuff.

*/
let kernel_speed;
this.main = function() {
    read_inputs();
    kernel_speed = get_kernel_speed();
    draw_screen();
}

let time = get_time(2);
function get_kernel_speed() {
    let old_time = time;
    time = get_time(2);
    return time - old_time;
}

function draw_screen() {
    printf("\?"); // Clear screen
    printf("Kernel speed: " + kernel_speed);
}

function read_inputs() {
    if(read(0) === "Escape") {
        printf("\?");
        exit();
    }
}
});
mkfile('/usr/bin/cat',function(){
this.main = function(args) {
    let fd = fopen(args, "r");
    let data = read(fd);
    if(typeof data === "string" || typeof data === "function")
        printf(data + '\n');
    else
        printf(JSON.stringify(data) + "\n");
    fclose(fd);
    exit();
}
});
mkfile('/usr/bin/js',function(){
this.main = function(args) {
    let fd = fopen(args, "r");
    (function(){(read(fd))();})()
    exit();
}
});
mkfile('/usr/bin/pico',function(){
let buffer = "";
let cursor = 0;
let filename = "";
let dir = "";
let filetype;
this.main = function(args) {
    filename = get_filename(args);
    dir = dirname(args);
    let fd = fopen(args, "w");
    buffer = read(fd);
    filetype = typeof buffer;
    if(filetype !== "string") {
        switch(filetype) {
            case "function":
                buffer = buffer.toString();
                break;
            case "object":
                buffer = JSON.stringify(buffer);
                break;
        }
    }
    fclose(fd);
    
    draw_screen();
    thread(read_input);
    sleep(-1);
}

function write_changes() {
    let fd = fopen(dir, "w");
    if(filetype === "function") {
        buffer = (new Function("return " + buffer))();
    }
    if(filetype === 'object') {
        buffer = JSON.parse(buffer);
    }
    write(fd, buffer);
    fclose(fd);
    printf("\nWrote changes to " + dir + "...\n");
}
function read_input() {
    let b = read(stdin);
    if(b.length > 0) {
        // Do key things
        switch(b) {
            case "Escape":
                write_changes();
                exit();
                break;
            case "ArrowLeft":
                move_cursor(-1)
                break;
            case "ArrowRight":
                move_cursor(1)
                break;
            case "ArrowUp":
                //TODO
                break;
            case "ArrowDown":
                //TODO
                break;
            default:
                for(let char of b) {
                    switch(char) {
                        case '\b':
                            buffer = del_char(buffer, cursor);
                            move_cursor(-1)
                            break;
                        default:
                            buffer = place_char(buffer, char, cursor);
                            move_cursor(1);
                            break;
                    }
                }
        }
        draw_screen();
    }
}
function draw_screen() {
    printf("\?");

    printf("file: "+dir + "\n\n" + place_char(buffer, "|", cursor));
}

function move_cursor(value) {
    cursor += value;
    if(cursor < 0)
        cursor = 0;
    if(cursor > buffer.length)
        cursor = buffer.length;
}

function place_char(buff, char, index) {
    let buf1 = buff.substring(0, index);
    let buf2 = buff.substring(index, buff.length);
    return buf1 + char + buf2;
}
function del_char(buff, index) {
    let buf1 = buff.substring(0, index - 1);
    let buf2 = buff.substring(index, buff.length);
    return buf1 + buf2;
}
});
mkfile('/usr/bin/mklclstr',function(){
// Make local storage

this.main = function(args) {
    
}
});
mkfile('/usr/bin/ls',function(){
this.main = function(args) {
    let fd;
    if(args.length === 0)
        fd = opendir(getcwd());
    else
        fd = opendir(args);
    let items = listdir(fd);
    for(let item of items) {
        printf(item + "  ");
    }
    printf('\n')
    exit();
}
});
mkfile('/usr/local');
mkfile('/usr/local/bin');
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
    function fopen(path, flags, mode) {
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
    function read(fd) {
        return c_process.get_descriptor(fd).read();
    }
    function write(fd, data) {
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
    function access(path) {
        return !(get_file(path).incomplete);
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
    function dirname(path) {
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
    function mount(device, path) {
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
        mount_table[filesystem.mountpoint] = undefined;
        inode.mountpoint = false;
        filesystem.mountpoint = false;
        filesystem.root.mountpoint = false;
    }
    function umount(path) {
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
    function getpid() {
        return c_process.pid;
    }
    function fork(intermediate_code) {
        if(!c_process) panic("Fork was run outside of kernel context");
        let process = c_process.clone(intermediate_code);
        if(process)
            processes.push(process);
        else
            return -1;
        return process.pid;
    }
    function wait() {
        if(!c_process) panic("wait() was run outside of kernel context");
        if(c_process.children.length !== 0)
            c_process.waiting = true;
        interrupt();
    }
    function exec(path, ...args) {
        let file = get_file(path);
        if(file.incomplete) throw new Error("File at " + path + " does not exist.");
        let code_object = file.inode.get_data();
        let code = new code_object();
        c_process.exec(code, args ?? [], full_path(path));
    }
    function thread(exec, args) {
        return c_process.add_thread(exec, args);
    }
    function cancel(pid) {
        c_process.cancel_thread(pid);
    }
    function sleep(time) {
        c_thread.sleep = time;
    }
    function exit() {
        c_process.kill();
        interrupt();
    }
    function kill(pid, sig) {
        let process = get_process(pid)
        if(!process) throw new Error("No process with PID " + pid);
        process.signal(sig);
    }
    function getpid() {
        return c_process.pid;
    }
    function getppid() {
        let parent = c_process.parent;
        if(!parent) throw new Error("Process does not have a parent.")
        return parent.pid;
    }
    function chdir(path) {
        let new_working_path = full_path(path);
        if(!access(new_working_path))
            throw new Error(new_working_path + " does not exist.");
        return c_process.working_path = new_working_path;
    }
    function getcwd() {
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
                        kdebug("Scheduler was early");
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
        function k_eval(string) {
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
    kdebug("Mounting temporary rootfs");
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
    }
    mkdir("/dev");
    create_devfs();
    create_device_pointer(root_fs, "disk0");

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
    function reboot(op) {
        switch(op) {
            case 2: // Change to be accurate to actual UNIX
                kdebug("Soft rebooting system (without unmounting)");
                reset();
                create_init();
                break;
            default:
                kdebug("Soft rebooting system...");
                reset();
                for(let fs of mount_table)
                    if(fs && typeof fs === "object")
                        unmount_fs(fs);
                create_devfs();
                create_init();
                break;
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
    let kernel_loop = () => {
        kernel_main();
        setTimeout(kernel_loop, loop_timeout);
    }
    kernel_loop(); // Start execution
}
});
mkfile('/bin');
mkfile('/bin/init',function(){
// JUNIX Init system: inspired by FreeBSD rc
let fd;
let pid;
this.main = () => {
    if(getpid() !== 1) {
        fprintf(stderr, "init can only run on PID 1\n");
        exit();
    }

    fd = fopen("/etc/services", "r");
    let paths = read(fd).split("\n");
    for(let path of paths)
        start(path);
    fclose(fd);
    fclose(stdio);
    fclose(stdin);
    fclose(stderr);

    pid = thread(post_driver);
    sleep(-1);
}
let wait = false;
function post_driver() {
    if(!wait) { // Allow the drivers to initialize before starting /etc/rc
        wait = true;
        return;
    }
    // Create stdin, stdio, and stderr
    fopen("/dev/keyboard", "r"); // Stdin
    fopen("/dev/console", "a"); // Stdio
    dup(stdio); // Stderr

    fd = fopen("/etc/os-release", "r")
    let deftable = map_variables(read(fd));
    printf(get_variable_value("NAME", deftable) + " " +
            get_variable_value("MAJOR_VERSION", deftable) +
            " [" + get_variable_value("MINOR_VERSION", deftable) + "]\n\n");
    fclose(fd);

    printf("Starting /etc/rc\n");
    fd = fopen("/etc/rc", "r");
    paths = read(fd).split("\n");
    for(let path of paths)
        start(path);
    printf("\n\n");

    cancel(pid);
}
function start (path) {
    printf("Starting " + path)
    console.log("starting " + path)
    fork(() => {
        fclose(fd);
        let _fd = fopen("/etc/login.conf", "r");
        exec(path, "", map_variables(read(_fd)));
        fclose(_fd);
        printf(" [" + getpid() + "]\n");
    });
}
});
mkfile('/bin/modload',function(){
// This program is responsible for detecting and initializing drivers for all hardware attached at all times

this.main() = () => {
}
});
mkfile('/bin/nigga',`echo Hello World!
echo I am about to bust nigga
echo NIGGER;echo HINDI`);
mkfile('/bin/umount',function(){
this.main = function(args) {
    umount(args);
    exit();
}
});
mkfile('/bin/kill',function(){
this.main = function(args) {
    let name_map = args.split(" ");
    let pid = parseInt(name_map[0]);
    let signal = parseInt(name_map[1] ?? 9);
    kill(pid, signal);
    exit();
}
});
mkfile('/bin/sh',function(){
let buffer = "";
const prompt = "#";
const cursor_char = "_";
let paths = [];
let env;
let executed = false;
const version_string = "sh 1.0"
let init = false;
let condition_met = true;
this.main = function(args, envp) {
    if(!init) {
        env = envp;
    
        paths = get_variable_value("PATH", env).split(":");
    
        printf(version_string+"\n")
        reprompt();
        init = true;
    }
    if(command_queue.length !== 0) {
        run_queue();
        return;
    }
    if(executed) {
        buffer = "";
        reprompt();
        executed = false;
    }
    let b = read(0);
    if(b.length > 0) {
        add_to_buffer(b)
        run_queue();
    }
}

function add_to_buffer(b) {
    printf('\b'); // Clear old cursor
    let command_ran = false;
    for(let i = 0; i < b.length; i++) {
        let a = b[i]; // Char

        switch(a) {
            case '\b':
                if(buffer.length - 1 < 0)
                    break;
                buffer = buffer.substring(0, buffer.length - 1);
                printf('\b')
                break;
            case '\n':
                printf('\n')
                command_ran = true;
                if(buffer.length > 0) {
                    parse_input(buffer);
                    break;
                }
                else
                    reprompt();
                break;
            default:
                printf(a)
                buffer += a;
                break;
        }
    }
    if(!command_ran)
        printf(cursor_char); // Add new cursor
}
function reprompt() {
    buffer = "";
    printf(prompt + " " + cursor_char);
}
function find_path(command) {
    for(let path of paths)
        if(listdir(opendir(path)).indexOf(command) !== -1)
            return path;
    return "";
}
let internal_commands = [
    ["exit", (args) => {
        exit();
    }],
    ["clear", () => {
        printf('\?');
    }],
    ["cd", (args) => {
        chdir(args);
    }],
    ["pwd", () => {
        printf(getcwd() + "\n");
    }],
    ["echo", (args) => {
        printf(args + "\n");
    }]
]
function run_script(string) {
    let commands = string.split("\n");
    for(let c of commands)
        parse_input(c);
}
function parse_input(buffer) {
    let token = "";
    let command = "";
    let add_to_queue = (conditional) => {
        if(token.length > 0) {
            if(command.length === 0)
                queue(token, "", conditional);
            else
                queue(command, token, conditional);
        }
        command = "";
        token = "";
    }
    for(let i = 0; i < buffer.length; i++) {
        let c = buffer[i];
        switch(c) {
            case "&":
                if(buffer[i+1] === "&")
                    add_to_queue(true);
                break;
            case '#':
                add_to_queue(false);
                return
            case ';':
                add_to_queue(false);
                break;
            case ' ':
                if(buffer[i+1] === " ")
                    break;
                if(command.length === 0 && token.length !== 0) {
                    command = token;
                    token = "";
                    break;
                }
                if(token.length === 0)
                    break;
            default:
                token+=c;
                break;
        }
    }
    if(token.length > 0 || command.length > 0)
        add_to_queue(false);
}
let command_queue = [];
function queue(command, args, conditional) {
    command_queue.push([command, args, conditional]);
}
function run_queue() {
    if(command_queue.length !== 0) {
        let cmd = command_queue[0];
        if(cmd[2]) {
            if(condition_met)
                condition_met = execute_command(cmd[0], cmd[1]) ? false : true;
        } else
            condition_met = execute_command(cmd[0], cmd[1]) ? false : true;
        command_queue.splice(0, 1);
        if(command_queue.length !== 0)
            sleep(1)
    }
}
function execute_command(command, args) {
    executed = true;

    let callback = internal_commands.find(a => {
        if (a[0] === command)
            return true;
    });
    if(callback) {
        try {
            callback[1](args);
        } catch (e) {
            if(!is_interrupt(e))
                fprintf(stderr, "sh: "+e+"\n")
        }
    } else {
        let cmdline = find_path(command) + "/" + command;
        if(!access(cmdline)) {
            fprintf(stderr, "Command "+command+" not found\n");
            return 1;
        }
        let fd = fopen(cmdline, "r");
        let data = read(fd);
        fclose(fd);
        if(typeof data === "string") {
            run_script(data);
            return 0;
        }
        try {
            fork(() => {
                exec(cmdline, args, env);
            });
            wait();
        } catch (e) {
            if(!is_interrupt(e))
                fprintf(stderr, "sh: " + e + "\n");
            return 1;
        }
    }
}
});
mkfile('/bin/mkdir',function(){
this.main = function(args) {
    console.log(args);
    mkdir(args);
    exit();
}
});
mkfile('/bin/mount',function(){
this.main = function(args) {
    let args_map = args.split(" ");
    let device = args_map[0];
    let mountpoint = args_map[1];
    mount(device, mountpoint);
    exit();
}
});
mkfile('/sbin');
mkfile('/sbin/reboot',function(){
this.main = function(args) {
    printf("Rebooting system...\n")
    reboot(parseInt(args));
}
});
mkfile('/etc');
mkfile('/etc/fstab',`/dev/disk0 /home`);
mkfile('/etc/os-release',`NAME=JUNIX
MAJOR_VERSION=1
MINOR_VERSION=1.0 Alpha`);
mkfile('/etc/rc',`/bin/sh`);
mkfile('/etc/login.conf',`PATH=/bin:/usr/bin:/usr/local/bin:/sbin`);
mkfile('/etc/services',`/service/disk
/service/mount
/service/keyboard
/service/console`);
mkfile('/var');
mkfile('/var/modalias',function(){

});
mkfile('/service');
mkfile('/service/mount',function(){
this.main = function() {
    // Mount permanent storage
    mount("/dev/disk1", "/home");
    exit();
}
});
mkfile('/service/disk',function(){
let disks = 1;
let fd;
this.main = function() {
    try {
        let string, fd, fs;
        for(let i = 0; i < localStorage.length; i++) {
            string = localStorage.getItem("disk" + i);
            if(string == null) break;
            fs = new JFS();
            fs.parse(string);
            fd = fopen("/dev/disk" + disks++, "w");
            printf("Created /dev/disk" + (disks-1) + "\n");
            write(fd, fs);
            fclose(fd);
        }
        if(localStorage.length === 0) throw "Needs initialization";
        printf("On-device storage has been mapped \n");
    } catch (e) {
        printf(e);
        create_disk();
        printf("On-device storage initialized\n");
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
    printf("Created /dev/disk" + disks++ + "\n");
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
}
});
mkfile('/service/keyboard',function(){
let fd;
let keys = "";

function keyupdate() {
    write(fd, keys);
    keys = "";
}
this.main = function() {
    fd = fopen("/dev/keyboard", "w", 777);
    thread(keyupdate, []);
    sleep(-1);
}

const key_replacements = [
    ["Backspace", '\b'],
    [' ', ' '],
    ["Shift", ''],
    ["Enter", '\n'],
    ["Meta", ''],
    ["Control", '\c']
]

function replace_keys(key) {
    for(let r of key_replacements)
        if(r[0] === key)
            return r[1];
    return key;
}

document.addEventListener("keydown", (e) => {
    keys += replace_keys(e.key);
    e.preventDefault();
});

document.addEventListener("keyup", (e) => {
    keys = keys.replaceAll(replace_keys(e.key), "");
});
});
mkfile('/service/serial',function(){
this.main = function() {

}
});
mkfile('/service/console',function(){
let fd, element;
let init = false;
this.main = function() {
    if(!init) {
        element = document.getElementById("console");
        fd = fopen("/dev/console", "w");
        init = true;
    }
    let string = read(fd);
    let buff = element.innerText;
    let char;
    for(let i = 0; i < string.length; i++) {
        char = string[i];
        switch(char) {
            case "\b":
                buff = buff.substring(0, buff.length - 1);
                break;
            case '\?':
                buff = "";
                break;
            default:
                buff += char;
                break;
        }
    }
    if(string.length > 0)
        element.innerText = buff
    write(fd, "");
    sleep(30)
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
    function fopen(path, flags, mode) {
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
    function read(fd) {
        return c_process.get_descriptor(fd).read();
    }
    function write(fd, data) {
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
    function access(path) {
        return !(get_file(path).incomplete);
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
    function dirname(path) {
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
    function mount(device, path) {
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
        mount_table[filesystem.mountpoint] = undefined;
        inode.mountpoint = false;
        filesystem.mountpoint = false;
        filesystem.root.mountpoint = false;
    }
    function umount(path) {
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
    function getpid() {
        return c_process.pid;
    }
    function fork(intermediate_code) {
        if(!c_process) panic("Fork was run outside of kernel context");
        let process = c_process.clone(intermediate_code);
        if(process)
            processes.push(process);
        else
            return -1;
        return process.pid;
    }
    function wait() {
        if(!c_process) panic("wait() was run outside of kernel context");
        if(c_process.children.length !== 0)
            c_process.waiting = true;
        interrupt();
    }
    function exec(path, ...args) {
        let file = get_file(path);
        if(file.incomplete) throw new Error("File at " + path + " does not exist.");
        let code_object = file.inode.get_data();
        let code = new code_object();
        c_process.exec(code, args ?? [], full_path(path));
    }
    function thread(exec, args) {
        return c_process.add_thread(exec, args);
    }
    function cancel(pid) {
        c_process.cancel_thread(pid);
    }
    function sleep(time) {
        c_thread.sleep = time;
    }
    function exit() {
        c_process.kill();
        interrupt();
    }
    function kill(pid, sig) {
        let process = get_process(pid)
        if(!process) throw new Error("No process with PID " + pid);
        process.signal(sig);
    }
    function getpid() {
        return c_process.pid;
    }
    function getppid() {
        let parent = c_process.parent;
        if(!parent) throw new Error("Process does not have a parent.")
        return parent.pid;
    }
    function chdir(path) {
        let new_working_path = full_path(path);
        if(!access(new_working_path))
            throw new Error(new_working_path + " does not exist.");
        return c_process.working_path = new_working_path;
    }
    function getcwd() {
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
                        kdebug("Scheduler was early");
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
        function k_eval(string) {
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
    kdebug("Mounting temporary rootfs");
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
    }
    mkdir("/dev");
    create_devfs();
    create_device_pointer(root_fs, "disk0");

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
    function reboot(op) {
        switch(op) {
            case 2: // Change to be accurate to actual UNIX
                kdebug("Soft rebooting system (without unmounting)");
                reset();
                create_init();
                break;
            default:
                kdebug("Soft rebooting system...");
                reset();
                for(let fs of mount_table)
                    if(fs && typeof fs === "object")
                        unmount_fs(fs);
                create_devfs();
                create_init();
                break;
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
    let kernel_loop = () => {
        kernel_main();
        setTimeout(kernel_loop, loop_timeout);
    }
    kernel_loop(); // Start execution
}
