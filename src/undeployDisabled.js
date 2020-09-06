const path = require("path");
const wildfly = require("./binaries/wildfly");
const util = require("./util/util");
const Jboss = require("./util/Jboss");

module.exports = async (conf, currentDir) => {
    console.log("\n**** Un-deploy disabled war files from Wildfly **** \n");

    const opt = util.getOptions(conf, null, schema);
    const wfDir = wildfly.getDir({ version: opt.version });

    const jboss = new Jboss({
        jbossHome: path.resolve(currentDir, wfDir),
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

const schema = {
    $id: "deploy",
    type: "object",
    additionalProperties: false,
    required: ["version"],
    properties: {
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