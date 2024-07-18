// Bootloader: run the kernel with the appropriate environment
function run_bootloader() {
    console.log("Bootloader started")

    console.log("Booting kernel...");
    kernel_entry({
        initfs_table: initfs_table
    }); // Start execution
}
run_bootloader();