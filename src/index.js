const path = require("path");
const fsPromises = require("fs").promises;
const rm = require("owp.rm");
const ProgressPromise = require("owp.progress-promise");
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
        binary.executions.forEach(execution => {
            executions.push({
                binary,
                execution
            });
            promises.push(execution.callback(currentDir, binariesDir));
        });
    });
    if (!executions.length) {
        return Promise.resolve();
    }
    return countdown.promises(
        "Run parallel executions",
        promises,
        executionFormat.bind(null, executions)
    );
}

function runSeqExecutions(binaries) {
    const bins = binaries.filter(binary => binary.seqExecutions);
    const executions = [];
    const promises = [];
    bins.forEach(binary => {
        const callbacks = [];
        binary.seqExecutions.forEach((execution, i) => {
            executions.push({
                binary,
                execution
            });
            promises.push(new ProgressPromise((resolve, reject, progress) => {
                callbacks.push(() => {
                    const exPromise = execution.callback(currentDir, binariesDir);
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
        "Run sequential executions",
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

function handleError(err) {
    console.error("Error:");
    console.error(err);
    process.exit(-1);
}

async function install(conf) {
    if (conf.binariesDir) {
        binariesDir = conf.binariesDir;
    }
    try {
        const { binaries, options, names } = Binaries.get(conf.binaries);

        util.printOptions(options, names, binariesDir);
        await util.queryContinue();

        await removeOldDirs(binaries);
        await downloadBinaries(binaries);
        await extractArchives(binaries);
        await runExecutions(binaries);
        await runSeqExecutions(binaries);
        await createStartScripts(binaries);

        return options;
    }
    catch (err) {
        handleError(err);
    }
}

async function keycloakExport(conf) {
    const keycloak = require("./binaries/keycloak");
    try {
        const binary = keycloak.export(conf);
        await runSeqExecutions([binary]);
    }
    catch (err) {
        handleError(err);
    }
}

module.exports = {
    install,
    keycloakExport
};

/*
TODO
ident linux versions

// Todo. Parameterize DS
// print "ADDING PERSISTENCE DATASOURCE TO WILDFLY"
// sh $WILDFLY_HOME/bin/jboss-cli.sh -c --command="/subsystem=datasources/data-source=gssDS:add(jndi-name=java:/gssDS, driver-name=postgresql, connection-url=jdbc:postgresql://$HOST:$POSTGRESQL_PORT/$PERSISTENCE_DB_NAME, user-name=$POSTGRESQL_USER, password=$POSTGRESQL_PASSWORD, valid-connection-checker-class-name=org.jboss.jca.adapters.jdbc.extensions.postgres.PostgreSQLValidConnectionChecker, validate-on-match=true)"

*/