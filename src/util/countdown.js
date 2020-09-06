const readline = require("readline");

function promises(title, promises, format) {
    let first = true;
    let numResolved = 0;
    const responses = new Array(promises.length);
    const progress = new Array(promises.length);
    responses.fill(null);
    function print() {
        if (first) {
            first = false;
        }
        else {
            readline.moveCursor(process.stdout, 0, -promises.length - 2);
        }
        console.log(`${title}: ${numResolved} / ${promises.length}`);
        for (let i = 0; i < promises.length; ++i) {
            const response = responses[i];
            const f = format(i, response, progress[i]);
            readline.clearLine(process.stdout);
            console.log(`    [${response !== null ? "X" : " "}] ${f}`);
        }
        console.log("");
    }
    print();
    return Promise.all(promises.map((promise, i) => {
        if (promise.progress) {
            promise.progress(p => {
                progress[i] = p;
                print();
            });
        }
        return new Promise((resolve, reject) => {
            promise
                .then(response => {
                    responses[i] = response;
                    ++numResolved;
                    print();
                    resolve(response);
                })
                .catch(reject);
        });
    }));
}

module.exports = {
    promises
};