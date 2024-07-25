function inode_parse(string) {
    let obj = JSON.parse(string);
    let data = obj.data;
    if(obj.data_type === "function") {
        data = (new Function("return " + obj.data + ""))();
    }
    return new Inode(obj.index, obj.parent_index, obj.filename, data, obj.type, obj.user, obj.mode);
}
class Inode {
    constructor(index, parent_index, filename, data, type, user, mode) {
        this.index = index;
        this.parent_index = parent_index;
        this.data = data;
        this.filename = filename;
        if(filename.length === 0) throw new Error("Invalid inode file name");
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
    stringify() {
        let data = this.data;
        let data_type = typeof this.data;
        if(data_type === "function")
            data = data.toString();
        return JSON.stringify({
            index: this.index,
            filename: this.filename,
            data: data,
            data_type: data_type,
            type: this.type,
            user: this.user,
            mode: this.mode,
            parent_index: this.parent_index
        });
    }
}

class JFS {
    constructor (options) {
        this.inodes = [new Inode(0, null, "/", [], "d", 0, 111)];
        this.mountpoint = false;
        this.casefold = true;
        if(options) {
            this.casefold = options.casefold ?? true;
        }
        this.magic = 20;
        this.uuid = random(0, 8196);
        this.fds = 0;
    }
    stringify() {
        let inodes = [];
        for(let inode of this.inodes)
            inodes.push(inode.stringify());
        return JSON.stringify({
            inodes: inodes,
            casefold: this.casefold,
            magic: 20,
            uuid: this.uuid
        })  
    }
    parse(string) {
        let obj = JSON.parse(string);
        if(obj.magic !== 20) throw new Error("Parsing filesystem failed: magic number incorrect (" + obj.magic + " instead of 20)");
        let inodes = [];
        for(let inode_string of obj.inodes)
            inodes.push(inode_parse(inode_string))
        this.inodes = inodes;
        this.casefold = obj.casefold;
        this.magic = obj.magic;
        this.uuid = obj.uuid;
    }
    create_file(parent_index, filename, data, type, user, mode) {
        let parent_inode = this.get_inode(parent_index);
        let index = this.inodes.length;
        for(let i = 1; i < this.inodes.length; i++) {
            if(!this.inodes[i]) {
                index = i;
                break;
            }
        }
        let inode = new Inode(index, parent_index, filename, data, type, user, mode);
        this.inodes[index] = inode;
        parent_inode.add_directory_entry(index);
        return inode;
    }
    delete_file(index) {
        // Remove inode reference from parent
        let inode = this.get_inode(index);
        let parent_inode = this.get_inode(inode.parent_index);
        parent_inode.remove_directory_entry(index);
        // Unlink from FS tree
        this.inodes[index] = undefined;
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
        this.inodes[0].mountpoint = index;
    }
    sync() {
        // Defined by driver
    }
}