const path = require("path");
const extract = require("../util/extract");
const countdown = require("../util/countdown");

module.exports = (binaries, currentDir, binariesDir) => {
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
};