const exec = require("util").promisify(require("child_process").exec);
const countdown = require("../util/countdown");

module.exports = (repos, cwd) => {
    const promises = repos.map(r =>
        exec(`git clone ${r.url}`, { cwd: r.cwd || cwd })
    );
    return countdown.promises("Clone repositories", promises, (i) =>
        repos[i].url
    );
};