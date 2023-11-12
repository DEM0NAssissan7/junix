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
    constructor () {
        this.root = new Inode(0, "/", [], "d", 0, 111);
        this.inodes = [this.root];
        this.indexes = 1;
        this.is_mounted = false;
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
    mount(path) {
        this.is_mounted = true;
    }
}