const path = require("path");
const os = require("os");
const rm = require("owp.rm");
const util = require("../util/util");
const mv = require("../util/mv");

module.exports = (conf, currentDir, mongodb) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = getFilename(opt);
    const dir = util.getDir(filename);

    return {
        name: "MongoDB DB Tools",
        dir,
        filename,
        url: `https://fastdl.mongodb.org/tools/db/${filename}`,
        options: opt,
        isArchive: true,

        executions: [
            {
                name: "Moving content to MongoDB/bin directory",
                callback: () => {
                    const from = path.resolve(currentDir, dir, "bin");
                    const to = path.resolve(currentDir, mongodb.dir, "bin");
                    return new Promise((resolve, reject) => {
                        mv(from, to)
                            .then(() => {
                                rm(dir, { recursive: true })
                                    .then(resolve)
                                    .catch(reject);
                            })
                            .catch(reject);
                    });
                }
            }
        ]

    };
};

module.exports.id = "mongodbDbTools";

const defaultConf = {
    linuxDist: "ubuntu1804"
};

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" },
        linuxDist: { type: "string" }
    }
};

schema.required = Object.keys(schema.properties);

function getFilename(opt) {
    switch (os.platform()) {
        //Windows
        case "win32":
            return `mongodb-database-tools-windows-x86_64-${opt.version}.zip`;
        //OSX
        case "darwin":
            return `mongodb-database-tools-macos-x86_64-${opt.version}.zip`;
        //Linux
        default:
            return `mongodb-database-tools-${opt.linuxDist}-x86_64-${opt.version}.tgz`;
    }
}