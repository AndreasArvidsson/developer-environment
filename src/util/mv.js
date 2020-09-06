const fsPromises = require("fs").promises;
const path = require("path");

function mv(source, dest) {
    return new Promise((resolve, reject) => {
        fsPromises.stat(source)
            .then(stats => {
                if (stats.isDirectory()) {
                    moveDir(source, dest)
                        .then(resolve)
                        .catch(reject);
                }
                else {
                    fsPromises.rename(source, dest)
                        .then(resolve)
                        .catch(reject);
                }
            })
            .catch(reject);
    });
}

function moveDir(source, dest) {
    return new Promise((resolve, reject) => {
        fsPromises.readdir(source)
            .then(files => {
                const promises = files.map(f =>
                    mv(path.resolve(source, f), path.resolve(dest, f))
                );
                Promise.all(promises)
                    .then(resolve)
                    .catch(reject);
            })
            .catch(reject);
    });
}

module.exports = mv;