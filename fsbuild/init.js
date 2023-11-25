mkfile("/bin/init", function() {
    let k = 0;
    this.main = () => {
        k++;
        this.open("/bin/hello");
        
        // Test
        let fd = fopen("/hello", "w");
        write(fd, "Hello World!");
        close(fd);
        fd = fopen("/hello", "r");
        console.log(read(fd));

        exit();
    }
    this.open = function(path) {
        exec(path);
        fork();
        exec("/bin/init");
    }
});
mkfile("/bin/init.d/");