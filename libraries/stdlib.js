const stdin = 0;
const stdio = 1;
const stderr = 2;
function fprintf(fd, message) {
    write(fd, message);
}
function printf(...messages) {
    for(let message of messages)
        fprintf(stdio, message);
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