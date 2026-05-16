let recovery_root_filesystem = null;
let recovery_boot_filesystem = null;
const boot = "ls0";
const root = "ls1";
let boot_options = [];
let boot_option_index = 0;
const recover_flag = 0;

// Bootloader: run the kernel with the appropriate environment
function populate_recovery() {
  if (initfs_table) {
    console.log("Building root recovery image");
    recovery_root_filesystem = build_filesystem(initfs_table);
  }
  if (bootfs_table) {
    console.log("Building boot recovery image");
    recovery_boot_filesystem = build_filesystem(bootfs_table);
  }
}
function run_recovery() {
  if (!recovery_root_filesystem || !recovery_boot_filesystem) {
    throw new Error(
      `Cannot recover: recovery filesystems are not properly defined`,
    );
  }
  console.warn(
    `Running recovery: Resetting all local data to recovery defaults`,
  );
  console.log(recovery_boot_filesystem, recovery_root_filesystem);
  localStorage.setItem(boot, recovery_boot_filesystem.stringify());
  localStorage.setItem(root, recovery_root_filesystem.stringify());
}

console.log("Bootloader started");

populate_recovery();

// See if we need to run a recovery sequence (i.e. boot is not valid)
{
  const strboot = localStorage.getItem(boot);
  const strroot = localStorage.getItem(root);
  if (strboot === null || strroot === null || recover_flag) run_recovery();
  // run_recovery();
}

console.log(`Reading boot manifest from ${boot}`);
{
  let string = localStorage.getItem(boot);
  let fs = new JFS();
  fs.parse(string);
  const manifest_file = fs.traverse_inode("boot.json");
  if (manifest_file.incomplete) {
    throw new Error(`Bootstrap failed: boot.json does not exist on boot drive`);
  }
  boot_options = manifest_file.inode.get_data();
}

// Run option select
boot_option_index = 0;

// Boot from selected option
const boot_option = boot_options[boot_option_index];
console.log(`Booting '${boot_option.name}'`);

console.log(`Reading ${boot_option.disk}`);
const str = localStorage.getItem(boot_option.disk);
if (str === null)
  throw new Error(`Cannot boot: ${boot_option.disk} is not a valid filesystem`);
const fs = new JFS();
fs.parse(str);

console.log(`Loading kernel '/${boot_option.kernel}'...`);
const file = fs.traverse_inode(boot_option.kernel);
if (file.incomplete)
  throw new Error(
    `Cannot boot: ${boot_option.kernel} does not exist on ${boot_option.disk}`,
  );
const kernel = file.inode.get_data();
eval(eliminate_func(kernel.toString())); // Evaluate kernel context to establish it in window
console.log("Booting: ", boot_option);
kernel_entry({ root: boot_option.root }); // Execute kernel
