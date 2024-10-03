{
    const framebuffer_device = "/dev/fbdev";
    const mouse_device = "/dev/mouse";
    const ctx_device = "/dev/ctx";
    const framerate = 60;
    let framebuff_fd, mouse_fd, ctx, ctx_fd;
    let init = false;
    let request_update = true;
    let cursor_canvas = new OffscreenCanvas(16, 16);
    let wallpaper_canvas;
    
    let detect_changes = () => {
        let mouse = read(mouse_fd);
        if (round(mouse.vectorX, 2) !== 0 || round(mouse.vectorY, 2) !== 0)
            return true;
        return false;
    }
    function init_wm() {
        framebuff_fd = fopen(framebuffer_device, "w");
        mouse_fd = fopen(mouse_device, "r");
        // Set mode
        let window_fd = fopen("/dev/window", "r");
        let _window = read(window_fd);
        write(framebuff_fd, {
            modeset: true,
            width: _window.width,
            height: _window.height
        });
        wallpaper_canvas = new OffscreenCanvas(_window.width, _window.height);
        wm_create_default_wallpaper();
        fclose(window_fd);

        ctx_fd = fopen(ctx_device, "r");
        ctx = read(ctx_fd);
        create_cursor_image(default_cursor_handler);

        init = true;
    }

    function update_wm() {
        request_update = detect_changes();
        if (request_update) {
            draw_background();
            // Render cursor
            render_cursor();
            console.log("frame");
            request_update = false;
        }
        sleep(1000 / framerate);
    }

    function create_cursor_image(handler) {
        let _ctx = cursor_canvas.getContext("2d");
        handler(_ctx);
    }
    function default_cursor_handler(_ctx) {
        ctx.strokeStyle = 'white';
        ctx.fillStyle = 'black';
        ctx.lineWidth = 1;
        ctx.beginPath();
        //Base (left)
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 13);
        //Handle (left)
        ctx.lineTo(3, 10);
        //Handle base (l/r)
        ctx.lineTo(5, 15);
        ctx.lineTo(8, 14);
        //Handle (right)
        ctx.lineTo(6, 9);
        //Base (right)
        ctx.lineTo(10, 9);
        ctx.lineTo(0, 0);
        
        ctx.fill();
        ctx.stroke();
    }
    function wm_render_cursor() {
        let mouse = read(mouse_fd);
        console.log(mouse);
        ctx.drawImage(cursor_canvas, mouse.x, mouse.y);
    }
    function wm_draw_background() {
        ctx.drawImage(wallpaper_canvas, 0, 0);
    }
    function wm_create_default_wallpaper() {
        let _ctx = wallpaper_canvas.getContext("2d");
        _ctx.fillRect(0, 0, wallpaper_canvas.width, wallpaper_canvas.height);
    }
}