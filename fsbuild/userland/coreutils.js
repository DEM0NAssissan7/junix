mkfile("/bin");
mkfile("/home");
mkfile("/bin/hello", function() {
    this.main = function() {
        console.log("Hello World! My PID is " + getpid());
        exit();
    }
});