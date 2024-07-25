// Interrupts
const interrupt_string = "interrupt"
let interrupt = function() {
    throw interrupt_string;
}
let is_interrupt = function(string) {
    if(string === interrupt_string) return true;
    return false;
}

function deep_obj(object) {
    return JSON.parse(JSON.stringify(object));
    // return object;
}

function round(number, accuracy) {
    let _a = Math.pow(10, accuracy);
    return Math.round(number * _a) / _a;
}

{
    let time = performance.now();
    function get_time(accuracy) {
        let a = accuracy ?? 1;
        return Math.round((performance.now() - time) * a) / a;
    }
}
let map_path_names = function (path) {
    let file_string = "";
    let string_list = [];
    if(!path) throw new Error("Invalid path");
    for (let i = 0; i < path.length; i++) {
        let char = path[i];
        switch (char) {
            case "/":
                if (file_string.length !== 0)
                    string_list.push(file_string);
                file_string = "";
                continue;
            case ".":
                if (i === path.length - 1) continue;
                switch (path[i + 1]) {
                    case ".":
                        if(path[i - 1]) {
                            if (path[i - 1] === "/") {
                                string_list.splice(string_list.length - 1, 1);
                                i += 2;
                                continue
                            }
                        }
                        break;
                    case "/":
                        i++;
                        continue;
                }
                break;
        }
        file_string += char;
    }
    if (file_string.length !== 0)
        string_list.push(file_string);
    return string_list;
}
let consolidate_path_names = function(path_names) {
    let retval = "/";
    for(let i = 0; i < path_names.length; i++) {
        retval += path_names[i];
        if(i < path_names.length - 1)
            retval += "/";
    }
    return retval;
}
let get_filename = function(path) {
    let filename = "";
    for (let i = 0; i < path.length; i++) {
        let char = path[i];
        if (char === "/") {
            filename = "";
            continue;
        }
        filename += char;
    }
    if(filename.length !== 0) return filename;
    return path;
}
let to_string = function(data) {
    let type = typeof data;
    if(type === "function")
        return data.toString();
    else return JSON.stringify(data);
}
let data_size = function(data) {
    return (new TextEncoder().encode(to_string(data))).length
}
let clear_cookies = function() {
    const cookies = document.cookie.split(";");

    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
}

// Encoding and decoding
let encode = function(uncoded_string, code) {
    let output_string = "";
    for(let i = 0; i < uncoded_string.length; i++) {
        let has_encoding = false;
        for(let j = 0; j < code.length; j++) {
            if(uncoded_string[i] === code[j][0]) {
                output_string += code[j][1];
                has_encoding = true;
                break;
            }
        }
        if(!has_encoding) output_string += uncoded_string[i];
    }
    return output_string;
}
let decode = function(coded_string, code) {
    let output_string = "";
    for(let i = 0; i < coded_string.length; i++) {
        let has_encoding = false;
        for(let j = 0; j < code.length; j++) {
            if(coded_string[i] === code[j][1]) {
                output_string += code[j][0];
                has_encoding = true;
                break;
            }
        }
        if(!has_encoding) output_string += coded_string[i];
    }
    return output_string;
}
function map_variables(string) {
    let buffer = "";
    let varname = "";
    let value = "";
    let deftable = [];
    for(let char of string) {
        switch(char) {
            case '=':
                if(varname.length > 0) {
                    value += buffer;
                    buffer = "";
                    break;
                }
                varname = buffer;
                buffer = "";
                break;
            case '\n':
                value += buffer;
                buffer = "";
                deftable.push([varname, value]);
                value = "";
                varname = "";
                break;
            default:
                buffer += char;
                break;
        }
    }
    if(buffer.length > 0)
        deftable.push([varname, buffer]);
    return deftable;
}
function map_env_vars(envp) {
    let deftable = [];
    for(let arg of envp) {
        let _deftable = map_variables(arg);
        if(_deftable.length < 1) continue;
        deftable.push(..._deftable);
    }
    return deftable;
}
function get_variable_value(identifier, deftable) {
    for(let def of deftable) {
        if(def[0] === identifier)
            return def[1];
    }
    return NaN;
}
function map_options(args) {

}

function random(min, max, accuracy) {
    let digits = Math.pow(10, accuracy ?? 0);
    return Math.floor(((Math.random() * max) * digits) / digits) + min
}