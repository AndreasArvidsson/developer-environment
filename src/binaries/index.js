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

    get: (conf) => {
        const binaries = [];
        const options = {};
        const names = {};
        for (let i in conf) {
            const binary = getBinary(conf, i);
            binaries.push(binary);
            options[i] = binary.options;
            names[i] = binary.name;
        }

        binaries.sort(util.binaryComparator);

        return { binaries, options, names };
    }

};

function getBinary(conf, id) {
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
            const mongoInstance = mongodb(mongoConf);
            return cons(c, mongoInstance);

        case jdbcPostgresql.id:
        case keycloakWildflyAdapter.id:
            const wildflyConf = conf[wildfly.id];
            if (!wildflyConf) {
                throw Error(`${id} without ${wildfly.id}`);
            }
            const wildflyInstance = wildfly(wildflyConf);
            return cons(c, wildflyInstance);

        case wildfly.id:
            const jdbcConf = conf[jdbcPostgresql.id];
            const jdbcInstance = jdbcConf ? jdbcPostgresql(jdbcConf) : null;
            return cons(c, jdbcInstance);

        default:
            return cons(c);

    }
}