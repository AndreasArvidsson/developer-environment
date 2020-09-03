const util = require("../util");

module.exports = (conf, wildfly) => {
    const opt = util.getOptions(conf, null, schema);
    const filename = `keycloak-wildfly-adapter-dist-${opt.version}.zip`;
    return {
        name: "Keycloak Wildfly Adapter",
        filename,
        url: `https://downloads.jboss.org/keycloak/${opt.version}/adapters/keycloak-oidc/${filename}`,
        options: opt,
        isArchive: true,
        extractTo: wildfly ? wildfly.dir : null
    };
};

module.exports.id = "keycloakWildflyAdapter";

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" }
    }
};

schema.required = Object.keys(schema.properties);