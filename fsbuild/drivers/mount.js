mkfile("/bin/init.d/mount", function() {
    this.main = function() {
        // Mount permanent storage
        mkdir("/mnt");
        mount("/dev/disk1", "/mnt");
    }
})