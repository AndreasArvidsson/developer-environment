const path = require("path");
const fsPromises = require("fs").promises;
const countdown = require("../util/countdown");

module.exports = (binaries, scriptsDir) => {
    const bins = binaries.filter(binary => binary.startScript);
    if (!bins.length) {
        return Promise.resolve();
    }
    const promises = bins.map(binary => {
        const file = path.resolve(scriptsDir, binary.startScript.filename);
        const content = `#!/bin/bash\n`
            + `echo "------ Starting: ${binary.name} ------"\necho\n`
            + binary.startScript.content;
        return fsPromises.writeFile(file, content)
    });
    return countdown.promises("Create start scripts", promises, (i, res) =>
        bins[i].name + (res !== null ? ` => ${bins[i].startScript.filename}` : "")
    );
};