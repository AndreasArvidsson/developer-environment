const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const util = require("../util/util");
const Jboss = require("../util/Jboss");

module.exports = (conf, cwd) => {
    const opt = util.getOptions(conf, getDefaultConf(), getSchema());
    const filename = getFilename(opt);
    const dir = util.getDir(filename);
    const jboss = new Jboss({
        jbossHome: path.resolve(cwd, dir),
        portOffset: opt.portOffset
    });

    const executions = [
        {
            name: `Add user: ${opt.username} / ${opt.password}`,
            callback: () => jboss.addUserKeycloak(opt.username, opt.password)
        }
    ];

    if (opt.jsonFile) {
        executions.push(
            getMigrationExecution(path.resolve(cwd, dir), opt, true),
            getStopServiceExecution(jboss)
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
            content: `${util.BASH_DIR}\n`
                + `$DIR/${dir}/bin/standalone.sh`
                + ` -Djboss.socket.binding.port-offset=${opt.portOffset}`
        }
    };
};

module.exports.id = "keycloak";

module.exports.export = (conf) => {
    const opt = util.getOptions(conf, getDefaultConf(true), getSchema(true));
    const filename = getFilename(opt);
    const dir = util.getDir(filename);
    const jbossHome = path.resolve(opt.cwd, dir);
    const jboss = new Jboss({
        jbossHome,
        portOffset: opt.portOffset
    });
    return {
        name: "Keycloak-export",
        executions: [
            getMigrationExecution(jbossHome, opt, false),
            getStopServiceExecution(jboss, opt)
        ]
    };
}

function getMigrationExecution(jbossHome, opt, doImport) {
    const action = doImport ? "import" : "export";
    return {
        name: `Start service with json ${action}`,
        callback: () => {
            const standalone = path.resolve(jbossHome, "bin/standalone.sh");
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
            //Wait 15sec for service to start.
            return util.waitIgnoreThen(
                exec(cmd),
                15,
                path.basename(opt.jsonFile)
            );
        }
    }
}

function getStopServiceExecution(jboss) {
    return {
        name: "Stop service",
        callback: () => {
            //Wait 1sec for service to stop.
            return util.wait(
                jboss.shutdown(),
                1
            );
        }
    };
}

function getFilename(opt) {
    return `keycloak-${opt.version}.zip`;
}

function getDefaultConf(isExport) {
    const res = {
        portOffset: 1
    };
    if (isExport) {
        res.jsonFile = "realm.json";
        res.cwd = process.cwd();
    }
    else {
        res.jsonFile = null;
        res.username = "admin";
        res.password = "password";
    }
    return res;
}

function getSchema(isExport) {
    const res = {
        type: "object",
        additionalProperties: false,
        properties: {
            version: { type: "string" },
            portOffset: { type: "number" }
        }
    };
    if (isExport) {
        res.$id = "keycloak-export";
        res.properties.jsonFile = { type: "string" };
        res.properties.cwd = { type: "string" };
        res.properties.realm = { type: "string" };
    }
    else {
        res.$id = module.exports.id;
        res.properties.jsonFile = { type: ["string", "null"] };
        res.properties.username = { type: "string" };
        res.properties.password = { type: "string" };
    }
    res.required = Object.keys(res.properties);
    return res;
}