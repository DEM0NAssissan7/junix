mkfile("/bin/init.d/keyboard", function() {
    let key;
    let fd;

    this.main = function() {
        fd = fopen("/dev/keyboard", "w", 777);
        thread(this.keyupdate);
    }

    this.keyupdate = function() {
        write(fd, key);
        sleep(10);
    }

    document.addEventListener("keydown", (e) => {
        key = e.key;
    });
});