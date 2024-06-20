import os
from os import listdir

osroot="root"
output_file="osimage.js"

if os.path.isfile(output_file):
    os.remove(output_file) # Remove old os image

def add_file(path):
    f=open(path, "r")
    w=open(output_file, "a")
    w.write("/* "+path+" */\n" + f.read() + "\n")

# Add necessary static files
add_file("libraries/mawi.js")
add_file("kernel/filesystem.js")
add_file("fsbuild.js")

def builddir(path, ref, level):
    files=listdir(path)

    prefix=""
    for i in range(level):
        prefix+="—"

    for file in files:
        printref=ref + "/" + file # What javascript sees
        pathref=path + "/" + file # Actual file path in relation to .
        if os.path.isfile(pathref) == True:
            print(prefix + " " + file)
            f=open(pathref, "r")
            w=open(output_file, "a")
            w.write("mkfile('"+printref+"',function(){\n"+f.read()+"\n});\n")
            f.close()
            w.close()
    print()
    for file in files:
        printref=ref + "/" + file # What javascript sees
        pathref=path + "/" + file # Actual file path in relation to .
        if os.path.isdir(pathref) == True:
            print(prefix + " " + printref)
            w=open(output_file, "a")
            w.write("mkfile('"+printref+"');\n")
            w.close()
            builddir(pathref, printref, level+1)        

print("Building OS image")
builddir(osroot, "", 0)

# Add kernel
add_file("boot.js")
add_file("kernel/kernel.js")