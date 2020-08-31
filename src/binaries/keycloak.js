const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const util = require("../util");

module.exports = (conf) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = `keycloak-${opt.version}.zip`;
    const dir = util.getDir(filename);
    const seqExecutions = [];

    if (opt.jsonFile) {
        seqExecutions.push(
            getMigrationExecution(dir, opt, true),
            getStopServiceExecution(dir, opt)
        );
    }

    return {
        name: "Keycloak",
        dir,
        filename,
        url: `https://downloads.jboss.org/keycloak/${opt.version}/${filename}`,
        options: opt,
        isArchive: true,
        seqExecutions,
        order: [
            "jsonFile"
        ],

        startScript: {
            filename: "startKeycloak.sh",
            content: `sh ${dir}/bin/standalone.sh`
                + ` -Djboss.socket.binding.port-offset=${opt.portOffset}`
        },

        executions: [
            {
                name: `Add user: ${opt.username} / ${opt.password}`,
                callback: (currentDir) => {
                    const addUser = path.resolve(currentDir, dir, "bin/add-user-keycloak.sh");
                    return exec(`sh ${addUser} -u ${opt.username} -p ${opt.password}`);
                }
            }
        ]

    };
};

module.exports.id = "keycloak";

module.exports.export = (conf) => {
    const instance = module.exports(conf);
    const opt = util.getOptions(conf, exportDefaultConf);
    instance.seqExecutions = [
        getMigrationExecution(instance.dir, opt, false),
        getStopServiceExecution(instance.dir, opt)
    ];
    return instance;
}

function getMigrationExecution(dir, opt, doImport) {
    const action = doImport ? "import" : "export";
    return {
        name: `Start service with json ${action}`,
        callback: (currentDir) => {
            const standalone = path.resolve(currentDir, dir, "bin/standalone.sh");
            let cmd = `sh ${standalone} `
                + `-Djboss.socket.binding.port-offset=${opt.portOffset} `
                + `-Dkeycloak.migration.action=${action} `
                + `-Dkeycloak.migration.provider=singleFile `
                + `-Dkeycloak.migration.file=${opt.jsonFile} `;
            if (doImport) {
                cmd += `-Dkeycloak.migration.strategy=OVERWRITE_EXISTING`;
            }
            else {
                cmd += `-Dkeycloak.migration.realmName=${opt.realm}`;
            }
            //Wait 10sec for service to start.
            return util.waitIgnoreThen(
                exec(cmd),
                10,
                path.basename(opt.jsonFile)
            );
        }
    }
}

function getStopServiceExecution(dir, opt) {
    return {
        name: "Stop service",
        callback: (currentDir) => {
            const jbossCli = path.resolve(currentDir, dir, "bin/jboss-cli.sh");
            //Wait 1sec for service to stop.
            return util.wait(
                util.jbossCommand(jbossCli, opt.portOffset, ":shutdown"),
                1
            );
        }
    };
}

const defaultConf = {
    username: "admin",
    password: "password",
    portOffset: 1,
    jsonFile: null
};

const exportDefaultConf = {
    ...defaultConf,
    jsonFile: "realm.json"
};

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" },
        username: { type: "string" },
        password: { type: "string" },
        portOffset: { type: "number" },
        jsonFile: { type: ["string", "null"] }
    }
};
schema.required = Object.keys(schema.properties);