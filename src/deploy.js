const path = require("path");
const fsPromises = require("fs").promises;
const wildfly = require("./binaries/wildfly");
const util = require("./util");
const Jboss = require("./Jboss");

module.exports = async (conf, currentDir) => {
    const opt = util.getOptions(conf, null, schema);
    const wfDir = wildfly.getDir({ version: opt.version });

    const jboss = new Jboss({
        jbossHome: path.resolve(currentDir, wfDir),
        host: opt.host,
        port: opt.port
    });

    const files = await findWarFiles(path.resolve(opt.dir));

    await printAndWait(files);

    const deployments = await jboss.getDeploymentInfo();

    for (let i = 0; i < files.length; ++i) {
        await deployFile(jboss, deployments, files[i]);
    }
};

async function deployFile(jboss, deployments, f) {
    console.log("---------")
    console.log(`path: ${f.path}`);
    console.log(`name: ${f.name}`);
    console.log(`runtime-name: ${f.runtimeName}`);
    await undeploy(jboss, deployments, f);
    await jboss.deploy(f.path, f.name, f.runtimeName);
    console.log("---------\n");
}

const schema = {
    $id: "deploy",
    type: "object",
    additionalProperties: false,
    required: ["version", "dir"],
    properties: {
        version: { type: "string" },
        host: { type: "string" },
        port: { type: "number" },
        dir: { type: "string" }
    }
};

async function undeploy(jboss, deployments, file) {
    let deployment = deployments.find(d => d.name === file.name);
    // Same name creates conflict always.
    if (deployment) {
        console.log(`Exact name '${file.name}' already exists.`);
        console.log("Undeploy/remove old deployment.")
        return jboss.undeploy(deployment.name);
    }
    deployment = deployments.find(d => d.runtimeName === file.runtimeName);
    // Same runtime name creates conflict if enabled.
    if (deployment) {
        console.log(`Exact runtime-name '${file.runtimeName}' already exists.`)
        if (deployment.enabled) {
            console.log(`Different name '${file.name}' and enabled. Undeploy, but keep content.`)
            return jboss.undeploy(deployment.name, true);
        }
        else {
            console.log(`Different name '${file.name}' and already disabled. Do nothing.`);
        }
    }
}

async function printAndWait(files) {
    console.log(`- Found ${files.length} files:`);
    files.forEach(f => {
        console.log("  ", f.name);
    });
    console.log();
    await util.queryContinue();
}

async function findWarFiles(dir) {
    const files = await fsPromises.readdir(dir);
    let res = [];
    for (let i in files) {
        const filename = files[i];
        const p = path.resolve(dir, filename);
        if (filename.endsWith(".war")) {
            res.push({
                name: filename,
                runtimeName: getRuntimeName(filename),
                path: p
            });
        }
        else {
            const stats = await fsPromises.lstat(p);
            if (stats.isDirectory()) {
                res = res.concat(
                    await findWarFiles(p)
                );
            }
        }
    }
    return res;
}

function getRuntimeName(filename) {
    const i = filename.lastIndexOf("-");
    if (i > -1) {
        return filename.substring(0, i) + (filename.endsWith(".war") ? ".war" : "");
    }
    return filename;
}