const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const fsPromises = require("fs").promises;
const Ajv = require("ajv");
const ProgressPromise = require("owp.progress-promise");

const binComparator = comparator.bind(null,
    ["Wildfly", "Keycloak", "Keycloak Wildfly Adapter", "MongoDB", "MongoDB DB Tools", "PostgreSQL", "JDBC PostgreSQL"]
);
const binaryComparator = (a, b) => {
    return binComparator(a.name, b.name);
}

module.exports = {
    binaryComparator,

    getOptions: (conf, defaultConf, schema) => {
        if (typeof conf === "string") {
            conf = {
                version: conf
            };
        }
        const res = Object.assign({}, defaultConf, conf);
        if (schema) {
            const ajv = new Ajv();
            if (!ajv.validate(schema, res)) {
                throw {
                    message: "Invalid options/configuration",
                    errors: getErrors(ajv.errors, schema.$id)
                };
            }
        }
        return res;
    },

    getDir: (filename) => {
        return filename.substring(0, filename.lastIndexOf("."));
    },

    jbossCommand: (jbossCli, portOffset, command) => {
        return exec(`sh ${jbossCli} -c controller=localhost:${9990 + portOffset} command="${command}"`);
    },

    wait: (promise, seconds) => {
        return new ProgressPromise((resolve, reject, progress) => {
            promise
                .then(res => {
                    timeout(() => {
                        resolve(res);
                    }, seconds, progress);
                })
                .catch(reject);
        });
    },

    waitIgnoreThen: (promise, seconds, resolveValue) => {
        return new ProgressPromise((resolve, reject, progress) => {
            promise.catch(reject);
            timeout(() => {
                resolve(resolveValue);
            }, seconds, progress);
        });
    },

    getFileSize: (path) => {
        return new Promise((resolve, reject) => {
            fsPromises.stat(path)
                .then(res => {
                    resolve(res.size);
                })
                .catch(err => {
                    //File doesnt exist.
                    if (err.code === "ENOENT") {
                        resolve(0);
                    }
                    else {
                        reject(err);
                    }
                })
        });
    },

    queryContinue: async () => {
        let run = true;
        while (run) {
            console.log("- Do you wish to continue? [Y/n]");
            const key = await keypress();
            switch (key.toLowerCase()) {
                case "yes":
                case "y":
                case "":
                    run = false;
                    break;
                case "no":
                case "n":
                    process.exit(0);
                default:
                    console.log("Please answer yes or no");
            }
        }
        console.log("");
    },

    printOptions: (options, names, binariesDir) => {
        console.log("- Parameters\n");
        console.log(`Installation dir: ${path.resolve()}`);
        console.log(`Binaries dir: ${binariesDir}\n`);

        const binaries = Object.keys(options).map(key => ({
            name: names[key],
            options: options[key]
        }));

        binaries.sort(binaryComparator);

        const comp = comparator.bind(null,
            ["version", "username", "password", "port", "portOffset", "debugPort"]
        );
        const optionsComparator = (a, b) => {
            if (a === "systemProperties") return 1;
            if (b === "systemProperties") return -1;
            return comp(a, b);
        }

        binaries.forEach(binary => {
            const o = binary.options;
            const oKeys = Object.keys(o).sort(optionsComparator);
            console.log(binary.name);
            oKeys.forEach(oKey => {
                const value = o[oKey];
                if (typeof value === "object") {
                    console.log(`    ${oKey}:`);
                    for (let i in value) {
                        console.log(`        ${i}: ${value[i]}`);
                    }
                }
                else {
                    console.log(`    ${oKey}: ${value}`);
                }
            });
            console.log("");
        });
    }

};

function comparator(order, a, b) {
    if (order.includes(a) && order.includes(b)) {
        return order.indexOf(a) - order.indexOf(b);
    }
    else if (order.includes(a)) {
        return -1;
    }
    else if (order.includes(b)) {
        return 1;
    }
    return a.localeCompare(b);
}

const keypress = () => {
    return new Promise(resolve => {
        process.stdin.setEncoding("utf-8");
        process.stdin.once("data", data => {
            resolve(data.trim());
        });
    })
}

function timeout(callback, secondsLeft, progress) {
    if (secondsLeft) {
        progress(`T-minus: ${secondsLeft}`);
        setTimeout(() => {
            timeout(callback, secondsLeft - 1, progress);
        }, 1000);
    }
    else {
        callback();
    }
}

function getErrors(errors, id) {
    errors.forEach(e => {
        e.dataPath = `${id}${e.dataPath}`;
        if (typeof e.params === "object") {
            e.params = JSON.stringify(e.params);
        }
    });
    return errors;
}