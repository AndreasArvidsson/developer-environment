const keycloak = require("./binaries/keycloak");
const runExecutions = require("./install/runExecutions");

module.exports = async (conf, currentDir) => {
    console.log("\n**** Export Keycloak json **** \n");
    const binary = keycloak.export(conf, currentDir);

    await runExecutions([binary]);

    console.log("- DONE!");
    process.exit(0);
};