const stdin = 0;
const stdout = 1;
const stderr = 2;
const SHELL = "/bin/sh";
function fprintf(fd, message) {
    write(fd, message);
}
function printf(...messages) {
    for(let message of messages)
        fprintf(stdout, message);
}
function fgetc(fd) {
    let string = read(fd);
    if(string.length > 0) return string;
    return false;
}
function system(...args) {
    fork(() => {
        exec(SHELL, args);
    });
}
function fopen(path, flags, mode) {
    if(path === "-")
        return stdout;
    if(path === "--")
        return stdin;
    return open(path, flags, mode);
}
function fclose(fd, close_special) {
    switch(fd) {
        case stdout:
        case stdin:
        case stderr:
            if(close_special)
                break;
            return;
        default:
            break;
    }
    return close(fd);
}