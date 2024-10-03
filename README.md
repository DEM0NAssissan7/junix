# JUNIX
Just a little fun project to experiment and learn more about operating systems.

## Compilation & General Structure
- The *entire* OS tree is stored in `./root`

> Note: the kernel is referenced in `/boot/kernel` to be used later with kexec when it is implemented. Just to mess around, I want to be able to replace the entire running kernel image with kexec instead of requiring a restart. I know it's unnecessary, but it's cool.

`build.py` creates a `osimage.js` file that, when loaded, parses the `./root` filesystem hierarchy and data into the actual root filesystem and bundles the kernel & all libraries. I highly advise against editing `osimage.js` directly and instead using the already existing setup.

## Kernel Structure
Of course, the core of the entire system that pulls everything together is the kernel

## Inspirations
- **Kernel architecture & syscalls** are primarily influenced by FreeBSD and Linux, although its inner workings is almost entirely my doing.
- **Driver system** is a mix between Minix and my own implementation
- **Init system** is highly influenced by FreeBSD's rc
- **Filesystem Hierarchy** is a mix between FreeBSD and Minix, but it is primarily influenced by FreeBSD.
- **Userland** is made to behave like any other UNIX-like system, but where needed, it mostly follows the FreeBSD system of things.

# TODO
- Implement library loading instead of making all libraries in the global scope
- Possibly integrate machine code interpretation/real 