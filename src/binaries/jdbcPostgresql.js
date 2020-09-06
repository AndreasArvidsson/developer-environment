const path = require("path");
const fsPromises = require("fs").promises;
const util = require("../util/util");

module.exports = (conf) => {
    const opt = util.getOptions(conf, null, schema);
    const filename = `postgresql-${opt.version}.jar`;
    return {
        name: "JDBC PostgreSQL",
        filename,
        url: `https://jdbc.postgresql.org/download/${filename}`,
        options: opt,
        jdbc: {
            name: "postgresql",
            moduleName: "org.postgresql",
            xaDataSourceClass: "org.postgresql.xa.PGXADataSource"
        }
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