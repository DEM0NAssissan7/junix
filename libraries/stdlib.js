function fprintf(message, fd) {
    write(fd, message);
}
function printf(message) {
    fprintf(message, 1);
}
function fgetc() {
    let string = read(fd);
    if(string.length > 0) return string;
    return false;
}