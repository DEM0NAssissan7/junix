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
