const path = require("path");
const util = require("../util/util");
const Binaries = require("../binaries/binaries");
const removeOldDirs = require("./removeOldDirs");
const downloadBinaries = require("./downloadBinaries");
const extractArchives = require("./extractArchives");
const runExecutions = require("./runExecutions");
const createStartScripts = require("./createStartScripts");
const cloneRepositories = require("./cloneRepositories");

module.exports = async (conf) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const binariesDir = path.resolve(opt.cwd, "[binaries]");
    const { binaries, options, names, order }
        = Binaries.get(opt.binaries, opt.cwd, binariesDir);

    printParameters(opt.cwd, options, names, order, opt.repositories);
    await util.queryContinue();

    if (binaries.length) {
        await removeOldDirs(binaries, opt.cwd);
        await downloadBinaries(binaries, binariesDir);
        await extractArchives(binaries, opt.cwd, binariesDir);
        await runExecutions(binaries);
        await createStartScripts(binaries, opt.cwd);
    }

    if (opt.repositories.length) {
        await cloneRepositories(opt.repositories, opt.cwd);
    }

    return options;
};

const defaultConf = {
    cwd: process.cwd(),
    binaries: {},
    repositories: []
};

const schema = {
    $id: "install",
    type: "object",
    additionalProperties: false,
    properties: {
        cwd: { type: "string" },
        binaries: { type: "object" },
        repositories: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["url"],
                properties: {
                    url: { type: "string" },
                    cwd: { type: "string" }
                }
            }
        }
    }
};

function printParameters(cwd, options, names, order, repositories) {
    console.log("- Parameters\n");
    console.log(`Installation dir: ${cwd}\n`);

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
        util.print(null, "Repositories", repositories.map(r => r.url));
        console.log("");
    }
}