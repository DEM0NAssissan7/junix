let buffer = [];
let background_buffer = [];
let previous_background = [0,0,0];
let width = 0;
let height = 0;
let cursor_size = 32;
let draw_color = [255,255,255,255];
let cursor_buffer = [];

// Initialization
function set_dimensions(width, height) {
    width = width;
    height = height;
    for(let i = 0; i < width * height * 4; i++)
        buffer[i] = 0; // Initialize buffer
}
function draw_cursor() {
    cursor_buffer = JSON.parse(JSON.stringify(buffer));
}

// Internal functions
function create_background_buffer() {
    for(let i = 0; i < width * height * 4; i+=4) {
        background_buffer[i] = previous_background[0];
        background_buffer[i+1] = previous_background[1];
        background_buffer[i+2] = previous_background[2];
        background_buffer[i+3] = 255;
    }
}

// User functions
function draw_buffer(fd) {
    write(fd ,buffer);
}
function color(r, g, b, a) {
    draw_color = [r,g,b,a];
}
function background(r, g, b) {
    if(r !== previous_background[0] || g !== previous_background[1] || b !== previous_background[2]) {
        previous_background = [r,g,b];
        create_background_buffer();
    }
    buffer = background_buffer;
}
function transparent_background() {
    for(let i = 0; i < width * height * 4; i+=4) {
        buffer[i+3] = 0;
    }
    create_background_buffer();
}