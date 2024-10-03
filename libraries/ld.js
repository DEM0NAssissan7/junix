{
    const lib_varname = "LIBS";
    const pid_varname = "LIBPID";
    const tmp_exec = "/tmp/prgm.js";
    let is_loaded = (envp) => {
        console.log(envp);
        return get_variable_value(pid_varname, envp) === getpid();
    }
    let eliminate_func = (string) => {
        let i1 = string.indexOf("{") + 1;
        let i2 = string.lastIndexOf("}");
        return string.substr(i1, i2 - i1);
    }
    function load(library_name, envp) {
        if(is_loaded(envp)) return null;
        // When using this function, pass in the env deftable
        let libs = get_variable_value(lib_varname, envp);
        if(!libs) {
            libs = "";
        }
        libs += library_name + ":";
        set_variable_value(lib_varname, libs, envp);
        return libs;
    }
    function ldlibs(argc, envp) {
        if(is_loaded(envp)) return null;

        // This function patches the running code of the calling process with the library added at the beginning.
        // This means that if the library has conflicting names, it WILL cause an error

        let fd = fopen(getexe(), "r");
        let code = eliminate_func(read(fd).toString());
        fclose(fd);
        fd = fopen(tmp_exec, "w");

        let c;
        let add_lib = (path) => {
            let _fd = fopen(path, "r");
            console.log(path)
            c = read(_fd).toString();

            // We need to eliminate the file's function(){...} part so that we can combine the library as part of the program's function
            c = eliminate_func(c) + "\n";

            console.log(c);
            fclose(_fd);
            c += code;
            code = c;
        }
        // We find the libraries in the LD_LIBRARY_PATH
        let libpath = get_variable_value("LD_LIBRARY_PATH", envp).split(":");
        let libs = get_variable_value(lib_varname, envp).split(":");
        set_variable_value(lib_varname, "", envp);

        let p;
        for(let lib of libs) {
            if(lib.length === 0) continue;
            let success = false;
            for(let path of libpath) {
                p = path + "/" + lib;
                if(access(p)) {
                    printf("Loading dynamic library '" + p + "'\n");
                    add_lib(p);
                    success = true;
                    break;
                }
            }
            if(!success) {
                fprintf(stderr, "Could not load library '" + lib + "'\n");
                exit(1);
            }
        }

        let F = new Function("return function(){" + code + "}");
        F.name = "func";
        write(fd, F());
        fclose(fd);

        printf("Running modified executable at " + tmp_exec + "\n");
        fork(() => {
            set_variable_value(pid_varname, getpid(), envp);
            exec(tmp_exec, argc, envp);
        });
        exit();
    }
}