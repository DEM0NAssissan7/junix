{
    const use_localstorage_driver = false;
    const use_initfs_only = !use_localstorage_driver;
    const root = '/dev/disk0';
    
    // Bootloader: run the kernel with the appropriate environment
    function run_bootloader() {
        console.log("Bootloader started")

        console.log("Booting kernel...");
        kernel_entry({
            initfs_table: initfs_table,
            use_localstorage_driver: use_localstorage_driver,
            root: root,
            use_initfs_only: use_initfs_only
        }); // Start execution
    }
    run_bootloader();
}