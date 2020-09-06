const http = require("http");
const https = require("https");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const ProgressPromise = require("owp.progress-promise");
const util = require("./util");

module.exports = (url, filePath) => {
    return new ProgressPromise(async (resolve, reject, progress) => {
        //Get size of existing file.
        const size = await util.getFileSize(filePath);

        //Since file doesnt exist we need to make sure that the directory does.
        if (size === 0) {
            const dir = path.resolve(filePath, "..");
            await fsPromises.mkdir(dir, { recursive: true });
        }

        const response = await get(url);

        const total = parseInt(response.headers["content-length"], 10);

        //Already have file with same size. Just abort.
        if (size === total) {
            resolve({
                url: url,
                file: filePath,
                size: total,
                message: "Already existed"
            });
            return;
        }

        let downloaded = 0;
        let lastPercentage = 0;

        response.on("data", chunk => {
            downloaded += chunk.length;
            const percentage = Math.floor(downloaded / total * 100);
            if (lastPercentage !== percentage) {
                lastPercentage = percentage;
                progress({
                    percentage,
                    downloaded,
                    total
                });
            }
        });

        const file = fs.createWriteStream(filePath);

        response.pipe(file);

        file.on("finish", () => {
            file.close(() => {
                resolve({
                    url: url,
                    file: filePath,
                    size: total,
                    message: "Downloaded"
                });
            });
        });

    });
};

function get(url) {
    const httpGet = url.startsWith("https") ? https.get : http.get;
    return new Promise(resolve => {
        const request = httpGet(url, response => {
            if (response.statusCode !== 200) {
                throw {
                    url: url,
                    file: filePath,
                    message: `${response.statusMessage} (${response.statusCode})`
                };
            }
            else {
                resolve(response);
            }
        });
        request.on("error", err => {
            throw {
                url: url,
                file: filePath,
                message: err
            };
        });
    });
}