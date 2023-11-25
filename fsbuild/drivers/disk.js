mkfile("/bin/init.d/disk", function() {
    let disks = 0;
    this.main = function() {
        try {
            let fs = new JFS();
            fs.parse(localStorage.getItem("storage"));
            devfs.create_file(0, "disk" + disks++, fs, "m", 0, 755);
            kdebug("On-device storage has been mapped");
        } catch (e) {
            let fs = new JFS();
            localStorage.setItem("storage", fs);
            devfs.create_file(0, "disk" + disks++, fs, "m", 0, 755);
            kdebug("On-device storage initialized");
        }
        exit();
    }
})