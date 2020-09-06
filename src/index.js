const path = require("path");

const currentDir = path.resolve();

async function install(conf) {
    try {
        const install = require("./install/install");
        return install(conf, currentDir);
    }
    catch (err) {
        handleError(err);
    }
}

async function keycloakExport(conf) {
    try {
        const keycloakExport = require("./keycloakExport");
        await keycloakExport(conf, currentDir);
    }
    catch (err) {
        handleError(err);
    }
}

async function deploy(conf) {
    try {
        const deploy = require("./deploy");
        await deploy(conf, currentDir);
    }
    catch (err) {
        handleError(err);
    }
}

async function undeployDisabled(conf) {
    try {
        const undeployDisabled = require("./undeployDisabled");
        await undeployDisabled(conf, currentDir);
    }
    catch (err) {
        handleError(err);
    }
}

module.exports = {
    install,
    keycloakExport,
    deploy,
    undeployDisabled
};

function handleError(err) {
    console.error("Error:");
    console.error(err);
    process.exit(-1);
}