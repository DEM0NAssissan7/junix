let initfs_table = [];
let bootfs_table = [];

let mkfile_general = function (path, data, table) {
  if (!path) throw new Error("Must pass a path.");
  if (data) table.push([path, data]);
  else if (!data) table.push([path]);
};
let mkfile = function (path, data) {
  mkfile_general(path, data, initfs_table);
};

let mkfile_boot = function (path, data) {
  mkfile_general(path, data, bootfs_table);
};

let build_filesystem = function (table) {
  let fs = new JFS();
  for (let entry of table) {
    const path = entry[0];
    const file = fs.traverse_inode(path);
    let data = [];
    let type = "d";
    if (entry.length === 2) {
      data = entry[1];
      type = "-";
    }
    fs.create_file(file.inode.index, get_filename(path), data, type, 0, 711);
  }
  return fs;
};
