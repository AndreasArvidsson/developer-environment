const fs = require("fs");
const extractZip = require("extract-zip")
const tar = require("tar");

module.exports = (source, destination) => {
    if (source.endsWith(".tar.gz") || source.endsWith(".tgz")) {
        return tar.extract({
            file: source,
            cwd: destination
        });
    }
    else if (source.endsWith(".zip")) {
        return extractZip(source, { dir: destination });
    }
    else {
        throw Error(`Can't extract unkown archive ${source}`)
    }
};