const path = require("path");
const rm = require("owp.rm");
const countdown = require("../util/countdown");

module.exports = (binaries, currentDir) => {
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
};