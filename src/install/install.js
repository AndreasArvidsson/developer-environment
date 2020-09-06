const path = require("path");
const util = require("../util/util");
const Binaries = require("../binaries/binaries");
const removeOldDirs = require("./removeOldDirs");
const downloadBinaries = require("./downloadBinaries");
const extractArchives = require("./extractArchives");
const runExecutions = require("./runExecutions");
const createStartScripts = require("./createStartScripts");
const cloneRepositories = require("./cloneRepositories");

module.exports = async (conf, currentDir) => {
    util.validate(schema, conf);

    const params = getParams(conf, currentDir);
    printParameters(currentDir, params);
    await util.queryContinue();

    const { binaries, repositories, options } = params;

    if (binaries.length) {
        const { binariesDir, scriptsDir } = params;
        await removeOldDirs(binaries, currentDir, binariesDir);
        await downloadBinaries(binaries, binariesDir);
        await extractArchives(binaries, currentDir, binariesDir);
        await runExecutions(binaries, binariesDir);
        await createStartScripts(binaries, scriptsDir);
    }

    if (repositories.length) {
        await cloneRepositories(repositories);
    }

    return options;
};

const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
        binariesDir: { type: "string" },
        scriptsDir: { type: "string" },
        binaries: { type: "object" },
        repositories: {
            type: "array",
            items: {
                type: "string"
            }
        }
    }
};

function getParams(conf, currentDir) {
    const repositories = conf.repositories || [];
    const binariesDir = conf.binariesDir || path.resolve(currentDir, "[binaries]");
    const scriptsDir = conf.scriptsDir || currentDir;
    const res = Binaries.get(conf.binaries || {}, currentDir);
    return {
        ...res,
        repositories,
        binariesDir,
        scriptsDir
    }
}

function printParameters(currentDir, { options, names, order, binariesDir, scriptsDir, repositories }) {
    console.log("- Parameters\n");
    console.log(`Installation dir: ${currentDir}`);
    console.log(`Binaries dir: ${binariesDir}`);
    console.log(`Scripts dir: ${scriptsDir}\n`);

    const binaries = Object.keys(options).map(key => ({
        name: names[key],
        options: options[key],
        order: order[key]
    }));

    binaries.sort(Binaries.comparator);

    binaries.forEach(binary => {
        const comp = util.comparator(binary.order);
        util.print(comp, binary.name, binary.options);
        console.log("");
    });

    if (repositories.length) {
        util.print(null, "Repositories", repositories);
        console.log("");
    }
}