const path = require("path");
const fsPromises = require("fs").promises;
const util = require("../util");

module.exports = (conf, wildfly) => {
    const opt = util.getOptions(conf, null, schema);
    const filename = `postgresql-${opt.version}.jar`;
    const moduleName = "org.postgresql";

    return {
        name: "JDBC PostgreSQL",
        filename,
        url: `https://jdbc.postgresql.org/download/${filename}`,
        options: opt,
        jdbc: {
            name: "postgresql",
            moduleName,
            xaDataSourceClass: "org.postgresql.xa.PGXADataSource"
        },

        executions: [
            {
                name: "Install module in Wildfly",
                callback: (currentDir, binariesDir) => {
                    return installWildflyModule(
                        path.resolve(currentDir, wildfly.dir, "modules/org/postgresql/main"),
                        path.resolve(binariesDir, filename),
                        filename,
                        `<?xml version="1.0" ?>
<module xmlns="urn:jboss:module:1.3" name="${moduleName}">
    <resources>
        <resource-root path="${filename}"/>
    </resources>
    <dependencies>
        <module name="javax.api"/>
        <module name="javax.transaction.api"/>
    </dependencies>
</module>`
                    );
                }
            }
        ]

    };
};

module.exports.id = "jdbcPostgresql";

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" }
    }
};
schema.required = Object.keys(schema.properties);

function installWildflyModule(dir, binarySource, binaryFilename, xml) {
    return new Promise((resolve, reject) => {
        const xmlFile = path.resolve(dir, "module.xml");
        const binaryTarget = path.resolve(dir, binaryFilename);
        fsPromises.mkdir(dir, { recursive: true })
            .then(() => {
                Promise.all([
                    fsPromises.writeFile(xmlFile, xml),
                    fsPromises.copyFile(binarySource, binaryTarget)
                ])
                    .then(resolve)
                    .catch(reject);
            })
            .catch(reject);
    })
}