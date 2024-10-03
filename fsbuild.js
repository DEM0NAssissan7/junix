let initfs_table = [];

let mkfile = function(path, data) {
    if(!path) throw new Error("Must pass a path.");
    if(data)
        initfs_table.push([path, data]);
    else if(!data)
        initfs_table.push([path]);
}