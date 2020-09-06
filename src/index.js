const rm = require("owp.rm");
const ProgressPromise = require("owp.progress-promise");
const path = require("path");
const fsPromises = require("fs").promises;
const exec = require("util").promisify(require("child_process").exec);
const extract = require("./extract");
const download = require("./download");
const countdown = require("./countdown");
const Binaries = require("./binaries");
const util = require("./util");

const currentDir = path.resolve();
let binariesDir = path.resolve(currentDir, "[binaries]");

function removeOldDirs(binaries) {
    const bins = binaries.filter(binary => binary.dir);
    if (!bins.length) {
        return Promise.resolve();
    }
    const promises = bins.map(binary => {
        const dir = path.resolve(currentDir, binary.dir);
        return rm(dir, { recursive: true, force: true });
    });
    return countdown.promises("Remove old directories", promises, (i, res) => {
        if (res !== null) {
            if (res) {
                return `${bins[i].name} => Removed: ${bins[i].dir}`;
            }
            return `${bins[i].name} => Didn't exist`;
        }
        return bins[i].name;
    });
}

function downloadBinaries(binaries) {
    const promises = binaries.map(binary =>
        download(binary.url, path.resolve(binariesDir, binary.filename))
    );
    const MiB = 1048576;
    return countdown.promises("Downloading binaries", promises, (i, res, progress) => {
        let response = "";
        if (res) {
            response = `${res.message}: ${Math.round(res.size / 1048576)} MiB`;
        }
        else if (progress) {
            const downloaded = Math.round(progress.downloaded / MiB);
            const total = Math.round(progress.total / MiB);
            response = `${progress.percentage}% ${downloaded}/${total} MiB`;
        }
        return `${binaries[i].name} => ${response}`;
    });
}

function extractArchives(binaries) {
    const bins = binaries.filter(b => b.isArchive);
    const promises = bins.map(binary => {
        const binaryPath = path.resolve(binariesDir, binary.filename);
        if (binary.extractTo) {
            return extract(binaryPath, path.resolve(currentDir, binary.extractTo));
        }
        return extract(binaryPath, currentDir);
    });
    return countdown.promises("Extracting archives", promises, (i, res) =>
        bins[i].name + (res !== null ? ` => ${bins[i].extractTo || bins[i].dir}` : "")
    );
}

function runExecutions(binaries) {
    const bins = binaries.filter(binary => binary.executions);
    const executions = [];
    const promises = [];
    bins.forEach(binary => {
        const callbacks = [];
        binary.executions.forEach((execution, i) => {
            executions.push({
                binary,
                execution
            });
            promises.push(new ProgressPromise((resolve, reject, progress) => {
                callbacks.push(() => {
                    const exPromise = execution.callback(binariesDir);
                    if (exPromise.progress) {
                        exPromise.progress(progress);
                    }
                    exPromise.then(res => {
                        resolve(res);
                        //Run next callback.
                        if (i < callbacks.length - 1) {
                            callbacks[i + 1]();
                        }
                    })
                        .catch(reject);
                });
            }));
        });
        //Run first callback.
        if (callbacks.length) {
            callbacks[0]();
        }
    });
    if (!executions.length) {
        return Promise.resolve();
    }
    return countdown.promises(
        "Run executions",
        promises,
        executionFormat.bind(null, executions)
    );
}

function executionFormat(executions, i, res, progress) {
    let p = "";
    if (res !== null) {
        p = typeof res === "string" ? ` => ${res}` : "";
    }
    else if (progress) {
        p = ` => ${progress}`;
    }
    return `${executions[i].binary.name} | ${executions[i].execution.name}${p}`
}

function createStartScripts(binaries) {
    const bins = binaries.filter(binary => binary.startScript);
    if (!bins.length) {
        return Promise.resolve();
    }
    const promises = bins.map(binary => {
        const file = path.resolve(currentDir, binary.startScript.filename);
        const content = `#!/bin/bash\n`
            + `echo "------ Starting: ${binary.name} ------"\necho\n`
            + binary.startScript.content;
        return fsPromises.writeFile(file, content)
    });
    return countdown.promises("Create start scripts", promises, (i, res) =>
        bins[i].name + (res !== null ? ` => ${bins[i].startScript.filename}` : "")
    );
}

async function cloneRepositories(repos) {
    const promises = repos.map(r =>
        exec(`git clone ${r}`)
    );
    return countdown.promises("Clone repositories", promises, (i) =>
        repos[i]
    );
}

async function install(conf) {
    try {
        util.validate(installSchema, conf);

        const repositories = conf.repositories || [];
        if (conf.binariesDir) {
            binariesDir = conf.binariesDir;
        }

        const res = Binaries.get(conf.binaries || {}, currentDir);
        const { binaries, options, names, order } = res;

        util.printOptions(options, names, order, currentDir, binariesDir, repositories);
        await util.queryContinue();

        //Remove binaries that shouldn't be installed. 
        //They are just includes as ancillary options to other binaries.
        const bins = binaries.filter(b => b.options.install !== false);

        if (bins.length) {
            await removeOldDirs(bins);
            await downloadBinaries(bins);
            await extractArchives(bins);
            await runExecutions(bins);
            await createStartScripts(bins);
        }

        if (repositories.length) {
            await cloneRepositories(repositories);
        }

        return options;
    }
    catch (err) {
        handleError(err);
    }
}

async function keycloakExport(conf) {
    const keycloak = require("./binaries/keycloak");
    try {
        const binary = keycloak.export(conf, currentDir);
        await runExecutions([binary]);
    }
    catch (err) {
        handleError(err);
    }
}

async function deploy(conf) {
    console.log("\n**** Deploy war files to Wildfly **** \n");
    const deploy = require("./deploy");
    try {
        await deploy(conf, currentDir);
        console.log("- DONE!");
        process.exit(0);
    }
    catch (err) {
        handleError(err);
    }
}

module.exports = {
    install,
    keycloakExport,
    deploy
};

const installSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        binariesDir: { type: "string" },
        binaries: { type: "object" },
        repositories: {
            type: "array",
            items: {
                type: "string"
            }
        }
    }
};

function handleError(err) {
    console.error("Error:");
    console.error(err);
    process.exit(-1);
}