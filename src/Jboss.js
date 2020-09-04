const xml2js = require("xml2js");
const path = require("path");
const exec = require("util").promisify(require("child_process").exec);
const fsPromises = require("fs").promises;

module.exports = class Jboss {

    constructor(jbossHome) {
        this.jbossHome = jbossHome;
        this.dir = path.resolve(jbossHome, "bin");
        this.cli = path.resolve(this.dir, "jboss-cli.sh");
    }

    file(file) {
        return exec(`sh ${this.cli} --file="${file}"`);
    }

    command(...commands) {
        //Make sure all commands are wrapped in quotations in case they contain blank spaces.
        commands = commands.map(c => `"${c}"`).join(",");
        return exec(`sh ${this.cli} --commands=embed-server,${commands}`);
    }

    shutdown(portOffset = 0) {
        return exec(`sh ${this.cli} -c controller=localhost:${9990 + portOffset} command=:shutdown`);
    }

    addUser(username, password) {
        const addUser = path.resolve(this.dir, "add-user.sh");
        return exec(`sh ${addUser} ${username} ${password}`);
    }

    addUserKeycloak(username, password) {
        const addUser = path.resolve(this.dir, "add-user-keycloak.sh");
        return exec(`sh ${addUser} -u ${username} -p ${password}`);
    }

    installAdapter() {
        return this.file(
            path.resolve(this.dir, "adapter-install-offline.cli")
        );
    }

    secureDeployment(name, properties) {
        return this.command(
            `/subsystem=keycloak/secure-deployment=${name}:add(${toCSV(properties)})`
        );
    }

    addJdbcDriver(name, properties) {
        return this.command(
            `/subsystem=datasources/jdbc-driver=${name}:add(${toCSV(properties)})`
        );
    }

    addDataSource(name, properties) {
        return this.command(
            `/subsystem=datasources/data-source=${name}:add(${toCSV(properties)})`
        );
    }

    addSystemProperty(name, value) {
        return this.command(
            `/system-property=${name}:add(value=${value})`
        );
    }

    async installModule(binarySource, xml) {
        const moduleDir = await getModuleDir(xml);
        const dir = path.resolve(this.jbossHome, "modules", moduleDir, "main");
        const xmlFile = path.resolve(dir, "module.xml");
        const filename = path.basename(binarySource);
        const binaryTarget = path.resolve(dir, filename);
        await fsPromises.mkdir(dir, { recursive: true });
        await fsPromises.writeFile(xmlFile, xml);
        await fsPromises.copyFile(binarySource, binaryTarget);
    }

    async updateStandaloneConf(replace) {
        const confFile = path.resolve(this.dir, "standalone.conf");
        let content = await fsPromises.readFile(confFile, "utf-8");
        for (let i in replace) {
            content = content.replace(i, replace[i]);
        }
        await fsPromises.writeFile(confFile, content);
    }

}

function toCSV(obj) {
    //Convert key/val object to csv.
    return Object.keys(obj)
        .map(k => `${k}=${obj[k]}`)
        .join(", ");
}

function getModuleDir(xml) {
    const parser = new xml2js.Parser();
    return new Promise((resolve, reject) => {
        parser.parseString(xml, (err, result) => {
            if (err) {
                reject(er);
            }
            resolve(result.module.$.name.split(".").join("/"));
        });
    });
}