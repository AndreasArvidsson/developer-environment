const path = require("path");
const os = require("os");
const fsPromises = require("fs").promises;
const exec = require("util").promisify(require("child_process").exec);
const rm = require("owp.rm");
const util = require("../util");

module.exports = (conf, currentDir) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = getFilename(opt);
    const dir = "pgsql";

    return {
        name: "PostgreSQL",
        dir,
        filename,
        url: `http://get.enterprisedb.com/postgresql/${filename}`,
        options: opt,
        isArchive: true,

        startScript: {
            filename: "startPostgresql.sh",
            content: `${dir}/bin/pg_ctl`
                + ` -D ${dir}/data`
                + ` -o "-p ${opt.port}"`
                + ` start`
                + `\nread -r -d ''`
        },

        executions: [
            {
                name: "Initializing database cluster in /data dir",
                callback: () => {
                    return initializeDatabaseCluster(currentDir, dir, opt);
                }
            },
            {
                name: "Start service",
                callback: () => {
                    const pgctl = path.resolve(currentDir, dir, "bin/pg_ctl");
                    const dataDir = path.resolve(currentDir, dir, "data");
                    return new Promise((resolve, reject) => {
                        exec(`${pgctl} -D ${dataDir} -o "-p ${opt.port}" start`)
                            .catch(reject);
                        //Wait 1sec for the server to start.
                        setTimeout(resolve, 1000);
                    });
                }
            },
            {
                name: `Create database: ${opt.db}`,
                callback: () => {
                    const psql = path.resolve(currentDir, dir, "bin/psql");
                    return exec(`${psql} -c "CREATE DATABASE ${opt.db}" "user=${opt.username} dbname=postgres password=${opt.password}"`);
                }
            },
            {
                name: "Stop service",
                callback: () => {
                    const pgctl = path.resolve(currentDir, dir, "bin/pg_ctl");
                    const dataDir = path.resolve(currentDir, dir, "data");
                    return exec(`${pgctl} -D ${dataDir} stop`);
                }
            }
        ]
    };
};

module.exports.id = "postgresql";

const defaultConf = {
    install: true,
    username: "admin",
    password: "password",
    port: 5432,
    db: "myDB"
};

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" },
        install: { type: "boolean" },
        username: { type: "string" },
        password: { type: "string" },
        port: { type: "number" },
        db: { type: "string" }
    }
};
schema.required = Object.keys(schema.properties);

function getFilename(opt) {
    const arch = os.arch() === "x64" ? "-x64" : "";
    switch (os.platform()) {
        //Windows
        case "win32":
            return `postgresql-${opt.version}-windows${arch}-binaries.zip`;
        //OSX
        case "darwin":
            return `postgresql-${opt.version}-osx-binaries.zip`;
        //Linux
        default:
            return `postgresql-${opt.version}-linux${arch}-binaries.tar.gz`;
    }
}

function initializeDatabaseCluster(currentDir, dir, opt) {
    const homeDir = path.resolve(currentDir, dir);
    const initdb = path.resolve(homeDir, "bin/initdb");
    const dataDir = path.resolve(homeDir, "data");
    const pwFile = path.resolve(homeDir, "tmpPassFile");
    return new Promise((resolve, reject) => {
        //Create tmp password file.
        fsPromises.writeFile(pwFile, opt.password)
            .then(() => {
                //Create db cluster.
                exec(`${initdb} -D ${dataDir} -U ${opt.username} -E UTF8 -A md5 --pwfile=${pwFile}`)
                    .then(() => {
                        //Remove tmp file.
                        rm(pwFile)
                            .then(resolve)
                            .catch(reject);
                    })
                    .catch(reject);
            })
            .catch(reject);
    });
}