const path = require("path");
const wildfly = require("./binaries/wildfly");
const util = require("./util/util");
const Jboss = require("./util/Jboss");

module.exports = async (conf) => {
    console.log("\n**** Un-deploy disabled war files from Wildfly **** \n");

    const opt = util.getOptions(conf, defaultConf, schema);
    const wfDir = wildfly.getDir({ version: opt.version });

    const jboss = new Jboss({
        jbossHome: path.resolve(opt.cwd, wfDir),
        host: opt.host,
        port: opt.port,
        username: opt.username,
        password: opt.password
    });

    const deployments = await getDeployments(jboss);

    await printAndWait(deployments);

    for (let i = 0; i < deployments.length; ++i) {
        await jboss.undeploy(deployments[i].name);
    }

    console.log("- DONE!");
    process.exit(0);
};

const defaultConf = {
    cwd: process.cwd()
};

const schema = {
    $id: "undeployDisabled",
    type: "object",
    additionalProperties: false,
    required: ["cwd", "version"],
    properties: {
        cwd: { type: "string" },
        version: { type: "string" },
        host: { type: "string" },
        port: { type: ["number", "string"] },
        username: { type: "string" },
        password: { type: "string" }
    }
};

async function getDeployments(jboss) {
    const deployments = await jboss.getDeploymentInfo();
    return deployments.filter(f => !f.enabled);
}

async function printAndWait(deployments) {
    console.log(`- Found ${deployments.length} disabled deployments:`);
    deployments.forEach(f => {
        console.log("  ", f.name);
    });
    console.log();
    if (deployments.length) {
        await util.queryContinue();
    }
}