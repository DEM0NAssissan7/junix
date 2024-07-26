const stdin = 0;
const stdout = 1;
const stdio = stdout;
const stderr = 2;
function fprintf(fd, message) {
    write(fd, message);
}
function printf(...messages) {
    for(let message of messages)
        fprintf(stdout, message);
}
function fgetc() {
    let string = read(fd);
    if(string.length > 0) return string;
    return false;
}
function system(command, args) {
    fork(() => {
        exec(command, args);
    });
}