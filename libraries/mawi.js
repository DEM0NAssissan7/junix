function deep_obj(object) {
    return JSON.parse(JSON.stringify(object));
    // return object;
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
                        if (path[i + 2] === "/") {
                            string_list.splice(string_list.length - 1, 1);
                            i += 2;
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
    let retval = "";
    for(let name of path_names)
        retval += "/" + name;
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