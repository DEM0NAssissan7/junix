#!/usr/bin/python3

import os
from os import listdir

osroot="root"
osboot="boot"
output_file="osimage.js"

if os.path.isfile(output_file):
    os.remove(output_file) # Remove old os image

# Open up new os image
out=open(output_file, "a")

def add_file(path):
    s=open(path, "r")
    out.write("/* "+path+" */\n" + s.read() + "\n")

# Add necessary static files
add_file("libraries/mawi.js")
add_file("libraries/stdlib.js")
add_file("libraries/graphics.js")
add_file("libraries/ld.js")
add_file("libraries/filesystem.js")
add_file("fsbuild.js")

def listdir_skip_hidden(path):
    files=os.listdir(path)
    for file in files:
        if file.startswith('.'):
           files.remove(file)
    return files

STRING_TYPE = 0
FUNCTION_TYPE = 1

def write_file(source, js_path, write_command):
    s=open(source, "r")
    first_char = s.read(1)
    if first_char == "!": # string type
        if(s.read(1) != "\n"):
            s.seek(1)
        out.write(write_command + "('"+js_path+"',`"+s.read()+"`);\n")
    elif first_char == "[" or first_char == "{": # json type
        s.seek(0)
        out.write(write_command + "('"+js_path+"',JSON.parse(`"+s.read()+"`));\n")
    elif first_char == "-": # literal type
        if(s.read(1) != "\n"):
            s.seek(1)
        out.write(write_command + "('"+js_path+"',"+s.read()+");\n")
    else:
        s.seek(0)
        out.write(write_command + "('"+js_path+"',function(){\n"+s.read()+"\n});\n")
    # Close up file
    s.close()

def builddir(path, ref, level, write_command):
    files=listdir_skip_hidden(path)

    prefix=""
    for i in range(level):
        prefix+="—"

    for file in files:
        js_path=ref + "/" + file # What javascript sees
        source=path + "/" + file # Actual file path in relation to .
        if os.path.isfile(source) == True:
            print(prefix + " " + file)
            write_file(source, js_path, write_command)
    print()
    for file in files:
        js_path=ref + "/" + file # What javascript sees
        source=path + "/" + file # Actual file path in relation to .
        if os.path.isdir(source) == True:
            print(prefix + " " + js_path)
            out.write(write_command + "('"+js_path+"');\n")
            builddir(source, js_path, level+1, write_command)        

print("Building OS image")
builddir(osroot, "", 0, "mkfile")

print("Building OS boot image")
builddir(osboot, "", 0, "mkfile_boot")

# Add bootloader file(s)
add_file("bootloader/bootloader.js")