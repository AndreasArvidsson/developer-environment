const keycloak = require("./binaries/keycloak");
const runExecutions = require("./install/runExecutions");

module.exports = async (conf) => {
    console.log("\n**** Export Keycloak json **** \n");
    const binary = keycloak.export(conf);

    await runExecutions([binary]);

    console.log("- DONE!");
    process.exit(0);
};