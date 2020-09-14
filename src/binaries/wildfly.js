const path = require("path");
const util = require("../util/util");
const Jboss = require("../util/Jboss");

module.exports = (conf, cwd, binariesDir, { adapter, jdbc, postgresql } = {}) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = getFilename(opt);
    const dir = util.getDir(filename);
    const jboss = new Jboss({
        jbossHome: path.resolve(cwd, dir),
        portOffset: opt.portOffset
    });
    const mem = opt.memory;

    const executions = [
        {
            name: `Add user: ${opt.username} / ${opt.password}`,
            callback: () => 
                jboss.addUser(opt.username, opt.password)
        },
        {
            name: "Increase memory in standalone.conf",
            callback: () =>
                jboss.updateStandaloneConf({
                    "-Xms64m": `-Xms${mem.Xms}`,
                    "-Xmx512m": `-Xmx${mem.Xmx}`,
                    "-XX:MetaspaceSize=96M": `-XX:MetaspaceSize=${mem.MetaspaceSize}`,
                    "-XX:MaxMetaspaceSize=256m": `-XX:MaxMetaspaceSize=${mem.MaxMetaspaceSize}`
                })
        }
    ];

    const depNames = opt.secureDeployments.names || [];
    if (adapter) {
        executions.push({
            name: "Install Keycloak adapter",
            callback: () => 
                jboss.installAdapter()
        });

        depNames.forEach(name => {
            executions.push({
                name: `Secure deployment: ${name}`,
                callback: () => 
                    jboss.secureDeployment(name, opt.secureDeployments.properties || {})
            });
        });
    }
    else if (depNames.length) {
        throw Error(`Wildfly secure deployments without Keycloak adapter`);
    }

    Object.keys(opt.systemProperties).forEach(k => {
        executions.push({
            name: `Add system property: ${k}`,
            callback: () => 
                jboss.addSystemProperty(k, opt.systemProperties[k])
        });
    });

    if (jdbc) {
        const j = jdbc.jdbc;
        executions.push(
            {
                name: "Install JDBC module",
                callback: () =>
                    installModule(jboss, binariesDir, jdbc.filename, j.moduleName)
            },
            {
                name: `Add JDBC driver: ${j.name}`,
                callback: () =>
                    jboss.addJdbcDriver(j.name, {
                        "driver-name": j.name,
                        "driver-module-name": j.moduleName,
                        "driver-xa-datasource-class-name": j.xaDataSourceClass
                    })
            }
        );
    }

    if (opt.datasource) {
        if (!jdbc) {
            throw Error(`Wildfly datasource without jdbcPostgresql`);
        }
        if (!postgresql) {
            throw Error(`Wildfly datasource without postgresql`);
        }
        const j = jdbc.jdbc;
        const p = postgresql.options;
        executions.push({
            name: `Add datasource: ${opt.datasource}`,
            callback: () =>
                jboss.addDataSource(opt.datasource, {
                    "jndi-name": `java:/${opt.datasource}`,
                    "driver-name": j.name,
                    "connection-url": `jdbc:${j.name}://localhost:${p.port}/${p.db}`,
                    "user-name": p.username,
                    password: p.password,
                    "valid-connection-checker-class-name": "org.jboss.jca.adapters.jdbc.extensions.postgres.PostgreSQLValidConnectionChecker",
                    "validate-on-match": true
                })
        });
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
            "systemProperties",
            "secureDeployments"
        ],
        startScript: {
            filename: "startWildfly.sh",
            content: `${util.BASH_DIR}\n`
                + `$DIR/${dir}/bin/standalone.sh`
                + ` -Djboss.socket.binding.port-offset=${opt.portOffset}`
                + ` --debug ${opt.debugPort}`
        }
    };
};

module.exports.id = "wildfly";

module.exports.getDir = function (conf) {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = getFilename(opt);
    return util.getDir(filename);
}

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
    systemProperties: {},
    secureDeployments: {}
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
        systemProperties: { type: "object" },
        secureDeployments: {
            type: "object",
            additionalProperties: false,
            properties: {
                names: { type: "array" },
                properties: { type: "object" }
            }
        }
    }
};

schema.required = Object.keys(schema.properties);
schema.properties.memory.required = Object.keys(schema.properties.memory.properties);

function installModule(jboss, binariesDir, filename, moduleName) {
    return jboss.installModule(
        path.resolve(binariesDir, filename),
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

function getFilename(opt) {
    return `wildfly-${opt.version}.zip`;
}