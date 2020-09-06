const path = require("path");
const download = require("../util/download");
const countdown = require("../util/countdown");

module.exports = (binaries, binariesDir) => {
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
};