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

function raise_ten_to(a) {
    switch(a) { // Precalculated results to minimize overhead
        case 0:
            return 1;
        case 1:
            return 10;
        case 2:
            return 100;
        case 3:
            return 1000;
        case 4:
            return 10000;
        case 5:
            return 100000;
        default:
            return Math.pow(10, a);
    }
}

function round(number, accuracy) {
    let _a = raise_ten_to(accuracy ?? 0);
    return Math.round(number * _a) / _a;
}

{
    let time = performance.now();
    function get_time(accuracy) {
        return round(performance.now() - time, accuracy ?? 0);
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
function set_variable_value(identifier, value, deftable) {
    for(let def of deftable) {
        if(def[0] === identifier)
            return def[1] = value;
    }
    deftable.push([identifier, value]); // Add the entry if it does not exist
    return deftable;
}
function map_options(args) {

}

function random(min, max, accuracy) {
    let digits = raise_ten_to(accuracy ?? 0);
    return Math.floor(((Math.random() * max) * digits) / digits) + min
}
function byteSize (str) {
    return new Blob([str]).size;
}

function parse_arguments(string) {
    let args = [];
    let token = "";
    let double_quote = false;
    let c;
    for(let i = 0; i < string.length; i++) {
        c = string[i];
        let add_char = () => {
            token += c;
        }
        switch (c) {
            case '"':
                if(!double_quote)
                    double_quote = true;
                if(double_quote)
                    double_quote = false;
                break;
            case ' ':
                if(double_quote){
                    add_char();
                    break;
                }
                if(token.length !== 0) {
                    args.push(token);
                    token = "";
                    break;
                }
            default:
                add_char();
                break;
        }
        if(i === string.length - 1) {
            // When the arguments have ended
            if(double_quote)
                throw new Error('Unterminated double quote');
            if(token.length !== 0)
                args.push(token);
        }
    }
    return args;
}
function parse_command(string) {
    let cmd = string;
    let split_point = string.indexOf(" ");
    let args = [];
    if(split_point !== -1) {
        let arguments = string.substring(split_point + 1, string.length);
        args = parse_arguments(arguments);
        cmd = string.substring(0, split_point);
    }
    return {
        cmd: cmd,
        args: args
    }
}
function factory_reset_system() {
    console.warn("Running factory reset...");
    console.warn("Clearing local storage...");
    localStorage.clear();
    console.warn("Panic rebooting...");
    reboot(9);
}

// Libcat
class StringObj {
    separator = "@";
    data = null;
    type = null;
    constructor(data, type) {
        this.type = type;
        this.data = data;

        // If the data is not automatically stringed
        if(type === "object") {
            if(data.magic === 20) {
                // Filesystem
                this.data = data.stringify();
                this.type = "filesystem";
            } else {
                this.data = JSON.stringify(data);
            }
        } else if (type === "function") {
            this.data = data.toString();
        }
    }
    get_data() {
        switch(this.type) {
            case "object":
                return JSON.parse(this.data);
            case "function":
                return (new Function("return " + this.data + ""))();
            case "filesystem":
                return (new JFS).parse(this.data);
        }
        return this.data
    }
    stringify() {
        return this.data + this.separator + this.type
    }
    parse(string) {
        let split_point = string.lastIndexOf(this.separator);
        this.data = string.substring(0, split_point);
        this.type = string.substring(split_point + 1, string.length);
    }
}
function create_string(data) {
    return new StringObj(data, typeof data);
}