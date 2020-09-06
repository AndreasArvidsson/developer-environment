const util = require("../util/util");
const wildfly = require("./wildfly");
const keycloak = require("./keycloak");
const keycloakWildflyAdapter = require("./keycloakWildflyAdapter");
const jdbcPostgresql = require("./jdbcPostgresql");
const postgresql = require("./postgresql");
const mongodb = require("./mongodb");
const mongodbDatabaseTools = require("./mongodbDbTools");

const constructors = {
    [wildfly.id]: wildfly,
    [keycloak.id]: keycloak,
    [keycloakWildflyAdapter.id]: keycloakWildflyAdapter,
    [jdbcPostgresql.id]: jdbcPostgresql,
    [postgresql.id]: postgresql,
    [mongodb.id]: mongodb,
    [mongodbDatabaseTools.id]: mongodbDatabaseTools
};

const comp = util.comparator(
    ["Wildfly", "Keycloak", "Keycloak Wildfly Adapter", "MongoDB", "MongoDB DB Tools", "PostgreSQL", "JDBC PostgreSQL"]
);

module.exports = {
    comparator: (a, b) => {
        return comp(a.name, b.name);
    },

    get: function (conf, currentDir) {
        const binaries = [];
        const options = {};
        const names = {};
        const order = {};
        for (let i in conf) {
            const binary = getBinary(conf, i, currentDir);
            //Don't include binaries that shouldn't be installed. 
            //They are just includes as ancillary options to other binaries.
            if (binary.options.install !== false) {
                binaries.push(binary);
            }
            options[i] = binary.options;
            names[i] = binary.name;
            order[i] = binary.order || [];
        }

        binaries.sort(this.comparator);

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
            const wfDir = wildfly.getDir(wildflyConf);
            return cons(c, wfDir);

        case wildfly.id: {
            const adapterConf = conf[keycloakWildflyAdapter.id];
            const jdbcConf = conf[jdbcPostgresql.id];
            const postgresqlConf = conf[postgresql.id];
            const misc = {
                adapter: adapterConf ? keycloakWildflyAdapter(adapterConf) : null,
                jdbc: jdbcConf ? jdbcPostgresql(jdbcConf, currentDir) : null,
                postgresql: postgresqlConf ? postgresql(postgresqlConf, currentDir) : null
            };
            return cons(c, currentDir, misc);
        }

        default:
            return cons(c, currentDir);
    }
}