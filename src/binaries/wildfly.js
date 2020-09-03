const path = require("path");
const fsPromises = require("fs").promises;
const util = require("../util");
const Jboss = require("../Jboss");

module.exports = (conf, currentDir, { adapter, jdbc, postgresql }) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = `wildfly-${opt.version}.zip`;
    const dir = util.getDir(filename);
    const jboss = new Jboss(path.resolve(currentDir, dir));

    const executions = [
        {
            name: `Add user: ${opt.username} / ${opt.password}`,
            callback: () => jboss.addUser(opt.username, opt.password)
        },
        {
            name: "Increase memory in standalone.conf",
            callback: () => {
                return new Promise((resolve, reject) => {
                    const mem = opt.memory;
                    const confFile = path.resolve(currentDir, dir, "bin/standalone.conf");
                    fsPromises.readFile(confFile, "utf-8")
                        .then(res => {
                            res = res.replace("-Xms64m", `-Xms${mem.Xms}`);
                            res = res.replace("-Xmx512m", `-Xmx${mem.Xmx}`);
                            res = res.replace("-XX:MetaspaceSize=96M", `-XX:MetaspaceSize=${mem.MetaspaceSize}`);
                            res = res.replace("-XX:MaxMetaspaceSize=256m", `-XX:MaxMetaspaceSize=${mem.MaxMetaspaceSize}`);
                            fsPromises.writeFile(confFile, res)
                                .then(resolve)
                                .catch(reject);
                        })
                        .catch(reject);
                });
            }
        }
    ];

    Object.keys(opt.systemProperties).forEach(k => {
        executions.push({
            name: `Add system property: ${k}`,
            callback: () => jboss.addSystemProperty(k, opt.systemProperties[k])
        });
    });

    if (adapter) {
        executions.push({
            name: "Install Keycloak adapter",
            callback: () => jboss.installAdapter()
        });
    }

    if (jdbc) {
        const j = jdbc.jdbc;

        executions.push(
            {
                name: "Install JDBC module",
                callback: (binariesDir) => {
                    return installModule(
                        path.resolve(currentDir, dir, "modules/org/postgresql/main"),
                        path.resolve(binariesDir, jdbc.filename),
                        jdbc.filename,
                        `<?xml version="1.0" ?>
<module xmlns="urn:jboss:module:1.3" name="${j.moduleName}">
    <resources>
        <resource-root path="${jdbc.filename}"/>
    </resources>
    <dependencies>
        <module name="javax.api"/>
        <module name="javax.transaction.api"/>
    </dependencies>
</module>`
                    );
                }
            },
            {
                name: `Add JDBC driver: ${j.name}`,
                callback: () =>
                    jboss.addJdbcDriver(j.name, {
                        "driver-name": j.name,
                        "driver-module-name": j.moduleName,
                        "driver-xa-datasource-class-name": j.xaDataSourceClass
                    })
            });

        if (opt.datasource) {
            if (!postgresql) {
                throw Error(`Wildfly datasource without postgresql`);
            }
            executions.push({
                name: `Add datasource: ${jdbc.name}`,
                callback: () => {
                    const p = postgresql.options;
                    return jboss.addDataSource(opt.datasource, {
                        "jndi-name": `java:/${opt.datasource}`,
                        "driver-name": jdbc.name,
                        "connection-url": `jdbc:${jdbc.name}://localhost:${p.port}/${p.db}`,
                        "user-name": p.username,
                        password: p.password,
                        "valid-connection-checker-class-name": "org.jboss.jca.adapters.jdbc.extensions.postgres.PostgreSQLValidConnectionChecker",
                        "validate-on-match": true
                    });
                }
            });
        }
    }

    return {
        name: "Wildfly",
        dir,
        filename,
        url: `https://download.jboss.org/wildfly/${opt.version}/${filename}`,
        options: opt,
        isArchive: true,
        executions,
        order: [
            "datasource",
            "memory",
            "systemProperties"
        ],
        startScript: {
            filename: "startWildfly.sh",
            content: `sh ${dir}/bin/standalone.sh`
                + ` -Djboss.socket.binding.port-offset=${opt.portOffset}`
                + ` --debug ${opt.debugPort}`
        }
    };
};

module.exports.id = "wildfly";

const defaultConf = {
    portOffset: 0,
    debugPort: 8787,
    username: "admin",
    password: "password",
    datasource: null,
    memory: {
        Xms: "64m",
        Xmx: "2048m",
        MetaspaceSize: "96M",
        MaxMetaspaceSize: "1024m",
    },
    systemProperties: {}
};

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" },
        debugPort: { type: "number" },
        portOffset: { type: "number" },
        username: { type: "string" },
        password: { type: "string" },
        datasource: { type: ["string", "null"] },
        memory: {
            type: "object",
            additionalProperties: false,
            properties: {
                Xms: { type: "string" },
                Xmx: { type: "string" },
                MetaspaceSize: { type: "string" },
                MaxMetaspaceSize: { type: "string" }
            }
        },
        systemProperties: { type: "object" }
    }
};

schema.required = Object.keys(schema.properties);
schema.properties.memory.required = Object.keys(schema.properties.memory.properties);

function installModule(dir, binarySource, binaryFilename, xml) {
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