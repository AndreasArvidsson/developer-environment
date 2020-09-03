const wildfly = require("./wildfly");
const keycloak = require("./keycloak");
const keycloakWildflyAdapter = require("./keycloakWildflyAdapter");
const jdbcPostgresql = require("./jdbcPostgresql");
const postgresql = require("./postgresql");
const mongodb = require("./mongodb");
const mongodbDatabaseTools = require("./mongodbDbTools");
const util = require("../util");

const constructors = {
    [wildfly.id]: wildfly,
    [keycloak.id]: keycloak,
    [keycloakWildflyAdapter.id]: keycloakWildflyAdapter,
    [jdbcPostgresql.id]: jdbcPostgresql,
    [postgresql.id]: postgresql,
    [mongodb.id]: mongodb,
    [mongodbDatabaseTools.id]: mongodbDatabaseTools
};

module.exports = {

    get: (conf, currentDir) => {
        const binaries = [];
        const options = {};
        const names = {};
        const order = {};
        for (let i in conf) {
            const binary = getBinary(conf, i, currentDir);
            binaries.push(binary);
            options[i] = binary.options;
            names[i] = binary.name;
            order[i] = binary.order || [];
        }

        binaries.sort(util.binaryComparator);

        return { binaries, options, names, order };
    }

};

function getBinary(conf, id, currentDir) {
    const cons = constructors[id];
    if (!cons) {
        throw Error(`Unknown binary '${id}'`);
    }
    const c = conf[id];

    switch (id) {

        case mongodbDatabaseTools.id:
            const mongoConf = conf[mongodb.id];
            if (!mongoConf) {
                throw Error(`${id} without ${mongodb.id}`);
            }
            const mongoInstance = mongodb(mongoConf, currentDir);
            return cons(c, currentDir, mongoInstance);

        case keycloakWildflyAdapter.id:
            const wildflyConf = conf[wildfly.id];
            if (!wildflyConf) {
                throw Error(`${id} without ${wildfly.id}`);
            }
            const wildflyInstance = wildfly(wildflyConf, currentDir, {});
            return cons(c, wildflyInstance);

        case wildfly.id: {
            const adapterConf = conf[keycloakWildflyAdapter.id];
            const jdbcConf = conf[jdbcPostgresql.id];
            const postgresqlConf = conf[postgresql.id];
            const misc = {
                adapter: adapterConf ? keycloakWildflyAdapter(adapterConf, currentDir) : null,
                jdbc: jdbcConf ? jdbcPostgresql(jdbcConf, currentDir) : null,
                postgresql: postgresqlConf ? postgresql(postgresqlConf, currentDir) : null
            };
            return cons(c, currentDir, misc);
        }

        default:
            return cons(c, currentDir);
    }
}