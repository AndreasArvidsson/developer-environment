
async function install(conf) {
    try {
        const install = require("./install/install");
        return await install(conf);
    }
    catch (err) {
        handleError(err);
    }
}

async function keycloakExport(conf) {
    try {
        const keycloakExport = require("./keycloakExport");
        await keycloakExport(conf);
    }
    catch (err) {
        handleError(err);
    }
}

async function deploy(conf) {
    try {
        const deploy = require("./deploy");
        await deploy(conf);
    }
    catch (err) {
        handleError(err);
    }
}

async function undeployDisabled(conf) {
    try {
        const undeployDisabled = require("./undeployDisabled");
        await undeployDisabled(conf);
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