const path = require("path");
const fsPromises = require("fs").promises;
const Ajv = require("ajv");
const ProgressPromise = require("owp.progress-promise");

const binComparator = comparator(
    ["Wildfly", "Keycloak", "Keycloak Wildfly Adapter", "MongoDB", "MongoDB DB Tools", "PostgreSQL", "JDBC PostgreSQL"]
);
const binaryComparator = (a, b) => {
    return binComparator(a.name, b.name);
}

function validate(schema, obj) {
    const ajv = new Ajv();
    if (!ajv.validate(schema, obj)) {
        throw {
            message: "Invalid options/configuration",
            errors: getErrors(ajv.errors, schema.$id)
        };
    }
}

module.exports = {
    binaryComparator,
    validate,

    getOptions: (conf, defaultConf, schema) => {
        if (typeof conf === "string") {
            conf = {
                version: conf
            };
        }
        const res = Object.assign({}, defaultConf, conf);
        if (schema) {
            validate(schema, res);
        }
        return res;
    },

    getDir: (filename) => {
        return filename.substring(0, filename.lastIndexOf("."));
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

    printOptions: (options, names, order, currentDir, binariesDir, repositories) => {
        console.log("- Parameters\n");
        console.log(`Installation dir: ${currentDir}`);
        console.log(`Binaries dir: ${binariesDir}\n`);

        const binaries = Object.keys(options).map(key => ({
            name: names[key],
            options: options[key],
            order: order[key]
        }));

        binaries.sort(binaryComparator);

        binaries.forEach(binary => {
            const comp = comparator(binary.order);
            print(comp, binary.name, binary.options);
            console.log("");
        });

        if (repositories.length) {
            print(null, "Repositories", repositories);
            console.log("");
        }
    }

};

function comparator(order) {
    order = [
        "version",
        "install",
        "port",
        "portOffset",
        "debugPort",
        "username",
        "password"
    ].concat(order);
    return (a, b) => {
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
    id = id || "";
    errors.forEach(e => {
        e.dataPath = `${id}${e.dataPath}`;
        if (typeof e.params === "object") {
            e.params = JSON.stringify(e.params);
        }
    });
    return errors;
}

function print(comp, key, value, indent = "") {
    if (value === null) {
        return;
    }
    if (Array.isArray(value)) {
        if (!value.length) {
            return;
        }
        console.log(`${indent}${key}:`);
        for (let i in value) {
            console.log(`${indent}    ${value[i]}`);
        }
    }
    else if (typeof value === "object") {
        const keys = Object.keys(value).sort(comp);
        if (!keys.length) {
            return;
        }
        console.log(`${indent}${key}:`);
        keys.forEach(k => {
            print(comp, k, value[k], indent + "    ");
        });
    }
    else {
        console.log(`${indent}${key}: ${value}`);
    }
}