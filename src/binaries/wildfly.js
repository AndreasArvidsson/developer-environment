const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const fsPromises = require("fs").promises;
const util = require("../util");

module.exports = (conf, jdbcInstance) => {
    const opt = util.getOptions(conf, defaultConf, schema);
    const filename = `wildfly-${opt.version}.zip`;
    const dir = util.getDir(filename);
    const seqExecutions = [];

    if (jdbcInstance) {
        const jdbc = jdbcInstance.jdbc;
        seqExecutions.push({
            name: `Add JDBC driver: ${jdbc.name}`,
            callback: (currentDir) => {
                const jbossCli = path.resolve(currentDir, dir, "bin/jboss-cli.sh");
                return util.jbossCommand(jbossCli, opt.portOffset,
                    `/subsystem=datasources/jdbc-driver=${jdbc.name}:add(driver-name=${jdbc.name}, driver-module-name=${jdbc.moduleName}, driver-xa-datasource-class-name=${jdbc.xaDataSourceClass})`
                );
            }
        });
    }

    const propNames = Object.keys(opt.systemProperties);
    if (propNames.length) {
        seqExecutions.push({
            name: `Add system properties: ${propNames.join(", ")}`,
            callback: (currentDir) => {
                const jbossCli = path.resolve(currentDir, dir, "bin/jboss-cli.sh");
                const promises = [];
                for (let i in opt.systemProperties) {
                    const command = `/system-property=${i}:add(value=${opt.systemProperties[i]})`;
                    promises.push(util.jbossCommand(jbossCli, opt.portOffset, command));
                }
                return Promise.all(promises);
            }
        });
    }

    if (seqExecutions.length) {
        seqExecutions.unshift({
            name: "Start service",
            callback: (currentDir) => {
                const standalone = path.resolve(currentDir, dir, "bin/standalone.sh");
                //Wait 10sec for service to start.
                return util.waitIgnoreThen(
                    exec(`sh ${standalone} -Djboss.socket.binding.port-offset=${opt.portOffset}`),
                    5
                );
            }
        });
        seqExecutions.push({
            name: "Stop service",
            callback: (currentDir) => {
                const jbossCli = path.resolve(currentDir, dir, "bin/jboss-cli.sh");
                //Wait 1sec for service to stop.
                return util.wait(
                    util.jbossCommand(jbossCli, opt.portOffset, ":shutdown"),
                    1
                );
            }
        });
    }

    return {
        name: "Wildfly",
        dir,
        filename,
        url: `https://download.jboss.org/wildfly/${opt.version}/${filename}`,
        options: opt,
        isArchive: true,
        seqExecutions,

        startScript: {
            filename: "startWildfly.sh",
            content: `sh ${dir}/bin/standalone.sh`
                + ` -Djboss.socket.binding.port-offset=${opt.portOffset}`
                + ` --debug ${opt.debugPort}`
        },

        executions: [

            {
                name: `Add user: ${opt.username} / ${opt.password}`,
                callback: (currentDir) => {
                    const scriptFile = path.resolve(currentDir, dir, "bin/add-user.sh");
                    return exec(`sh ${scriptFile} ${opt.username} ${opt.password}`);
                }
            },

            {
                name: "Increase memory in standalone.conf",
                callback: (currentDir) => {
                    return new Promise((resolve, reject) => {
                        const confFile = path.resolve(currentDir, dir, "bin/standalone.conf");
                        fsPromises.readFile(confFile, "utf-8")
                            .then(res => {
                                res = res.replace("-Xms64m", `-Xms${opt.Xms}`);
                                res = res.replace("-Xmx512m", `-Xmx${opt.Xmx}`);
                                res = res.replace("-XX:MetaspaceSize=96M", `-XX:MetaspaceSize=${opt.MetaspaceSize}`);
                                res = res.replace("-XX:MaxMetaspaceSize=256m", `-XX:MaxMetaspaceSize=${opt.MaxMetaspaceSize}`);
                                fsPromises.writeFile(confFile, res)
                                    .then(resolve)
                                    .catch(reject);
                            })
                            .catch(reject);
                    });
                }
            }

        ]

    };
};

module.exports.id = "wildfly";

const defaultConf = {
    username: "admin",
    password: "password",
    debugPort: 8787,
    portOffset: 0,
    Xms: "64m",
    Xmx: "2048m",
    MetaspaceSize: "96M",
    MaxMetaspaceSize: "1024m",
    systemProperties: {}
};

const schema = {
    $id: module.exports.id,
    type: "object",
    additionalProperties: false,
    properties: {
        version: { type: "string" },
        username: { type: "string" },
        password: { type: "string" },
        debugPort: { type: "number" },
        portOffset: { type: "number" },
        Xms: { type: "string" },
        Xmx: { type: "string" },
        MetaspaceSize: { type: "string" },
        MaxMetaspaceSize: { type: "string" },
        systemProperties: { type: "object" }
    }
};
schema.required = Object.keys(schema.properties);