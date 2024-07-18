function inode_parse(string) {
    let obj = JSON.parse(string);
    let data = obj.data;
    if(obj.data_type === "function")
        data = (new Function("return function(){" + obj.data + "}"))();
    return new Inode(obj.index, obj.path, data, obj.type, obj.user, obj.mode);
}
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
    stringify() {
        let data = this.data;
        if(typeof this.data === "function")
            data = data.toString();
        return JSON.stringify({
            index: this.index,
            path: this.path,
            data: this.data,
            data_type: typeof this.data,
            filename: this.filename,
            type: this.type,
            user: this.user,
            mode: this.mode
        });
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
    stringify() {
        let inodes = [];
        for(let inode of this.inodes)
            inodes.push(inode.stringify());
        return JSON.stringify({
            root: this.root.stringify(),
            inodes: inodes,
            indexes: this.indexes,
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
        this.root = inode_parse(obj.root);
        this.inodes = inodes;
        this.indexes = obj.indexes;
        this.casefold = obj.casefold;
        this.magic = obj.magic;
        this.uuid = obj.uuid;
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
    sync() {
        // Defined by driver
    }
}