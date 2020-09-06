const path = require("path");
const os = require("os");
const fsPromises = require("fs").promises;
const util = require("../util/util");

module.exports = (conf, cwd) => {
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
            content: `${util.BASH_DIR}\n`
                + `$DIR/${dir}/bin/mongod`
                + ` --dbpath=$DIR/${dir}/data`
                + ` --port ${opt.port}`
        },

        executions: [
            {
                name: "Creating database /data directory",
                callback: () => {
                    const dataDir = path.resolve(cwd, dir, "data");
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
        case "darwin": {
            const filename = `mongodb-macos-x86_64-${opt.version}.tgz`;
            return {
                osName: "osx",
                filename,
                dir: util.getDir(filename)
            }
        }
        //Linux
        default: {
            const filename = `mongodb-linux-x86_64-${opt.linuxDist}-${opt.version}.tgz`;
            return {
                osName: "linux",
                filename,
                dir: util.getDir(filename)
            }
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