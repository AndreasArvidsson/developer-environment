const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const util = require("../util");
const Jboss = require("../Jboss");

module.exports = (conf, currentDir) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = `keycloak-${opt.version}.zip`;
    const dir = util.getDir(filename);
    const jboss = new Jboss(path.resolve(currentDir, dir));

    const executions = [
        {
            name: `Add user: ${opt.username} / ${opt.password}`,
            callback: () => jboss.addUserKeycloak(opt.username, opt.password)
        }
    ];

    if (opt.jsonFile) {
        executions.push(
            getMigrationExecution(path.resolve(currentDir, dir), opt, true),
            getStopServiceExecution(jboss, opt)
        );
    }

    return {
        name: "Keycloak",
        dir,
        filename,
        url: `https://downloads.jboss.org/keycloak/${opt.version}/${filename}`,
        options: opt,
        isArchive: true,
        executions,
        order: [
            "jsonFile"
        ],
        startScript: {
            filename: "startKeycloak.sh",
            content: `sh ${dir}/bin/standalone.sh`
                + ` -Djboss.socket.binding.port-offset=${opt.portOffset}`
        }
    };
};

module.exports.id = "keycloak";

module.exports.export = (conf, currentDir) => {
    const instance = module.exports(conf);
    const opt = util.getOptions(conf, exportDefaultConf);
    const dir = path.resolve(currentDir, instance.dir);
    instance.executions = [
        getMigrationExecution(dir, opt, false),
        getStopServiceExecution(jboss, opt)
    ];
    return instance;
}

function getMigrationExecution(dir, opt, doImport) {
    const action = doImport ? "import" : "export";
    return {
        name: `Start service with json ${action}`,
        callback: () => {
            const standalone = path.resolve(dir, "bin/standalone.sh");
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

function getStopServiceExecution(jboss, opt) {
    return {
        name: "Stop service",
        callback: () => {
            //Wait 1sec for service to stop.
            return util.wait(
                jboss.shutdown(opt.portOffset),
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