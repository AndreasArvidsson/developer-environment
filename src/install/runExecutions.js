const ProgressPromise = require("owp.progress-promise");
const countdown = require("../util/countdown");

module.exports = (binaries, binariesDir) => {
    const bins = binaries.filter(binary => binary.executions);
    const executions = [];
    const promises = [];
    bins.forEach(binary => {
        const callbacks = [];
        binary.executions.forEach((execution, i) => {
            executions.push({
                binary,
                execution
            });
            promises.push(new ProgressPromise((resolve, reject, progress) => {
                callbacks.push(() => {
                    const exPromise = execution.callback(binariesDir);
                    if (exPromise.progress) {
                        exPromise.progress(progress);
                    }
                    exPromise.then(res => {
                        resolve(res);
                        //Run next callback.
                        if (i < callbacks.length - 1) {
                            callbacks[i + 1]();
                        }
                    })
                        .catch(reject);
                });
            }));
        });
        //Run first callback.
        if (callbacks.length) {
            callbacks[0]();
        }
    });
    if (!executions.length) {
        return Promise.resolve();
    }
    return countdown.promises(
        "Run executions",
        promises,
        format.bind(null, executions)
    );
};

function format(executions, i, res, progress) {
    let p = "";
    if (res !== null) {
        p = typeof res === "string" ? ` => ${res}` : "";
    }
    else if (progress) {
        p = ` => ${progress}`;
    }
    return `${executions[i].binary.name} | ${executions[i].execution.name}${p}`
}