const path = require("path");
const os = require("os");
const fsPromises = require("fs").promises;
const util = require("../util");

//TODO
console.log("os.platform", os.platform())
console.log("os.release", os.release())
console.log("os.type", os.type())
console.log("os.arch", os.arch())
console.log("os.version", os.version())

module.exports = (conf) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const { dir, filename, osName } = getNames(opt);

    return {
        name: "MongoDB",
        dir,
        filename,
        url: `https://fastdl.mongodb.org/${osName}/${filename}`,
        options: opt,
        isArchive: true,

        startScript: {
            filename: "startMongodb.sh",
            content: `${dir}/bin/mongod`
                + ` --dbpath=${dir}/data`
                + ` --port ${opt.port}`
        },

        executions: [
            {
                name: "Creating database /data directory",
                callback: (currentDir) => {
                    const dataDir = path.resolve(currentDir, dir, "data");
                    return fsPromises.mkdir(dataDir);
                }
            }
        ]

    };
};

module.exports.id = "mongodb";

function getNames(opt) {
    switch (os.platform()) {
        //Windows
        case "win32":
            return {
                osName: "windows",
                dir: `mongodb-win32-x86_64-windows-${opt.version}`,
                filename: `mongodb-windows-x86_64-${opt.version}.zip`
            }
        //OSX
        case "darwin":
            return {
                osName: "osx",
                filename: `mongodb-macos-x86_64-${opt.version}.tgz`,
                dir: util.getDir(filename)
            }
        //Linux
        default:
            return {
                osName: "linux",
                filename: `mongodb-linux-x86_64-${opt.linuxDist}-${opt.version}.tgz`,
                dir: util.getDir(filename)
            }
    }
}

const defaultConf = {
    port: 27017,
    linuxDist: "ubuntu1804"
};

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" },
        port: { type: "number" },
        linuxDist: { type: "string" }
    }
};
schema.required = Object.keys(schema.properties);