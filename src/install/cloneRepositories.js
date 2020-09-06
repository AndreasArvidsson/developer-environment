const exec = require("util").promisify(require("child_process").exec);
const countdown = require("../util/countdown");

module.exports = (repos) => {
    const promises = repos.map(r =>
        exec(`git clone ${r}`)
    );
    return countdown.promises("Clone repositories", promises, (i) =>
        repos[i]
    );
};