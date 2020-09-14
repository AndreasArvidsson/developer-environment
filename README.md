# Developer environment
Easy installation of developer environment.

## Description
1. Specify which binaries you require
1. Add configuration regarding those binaries
1. Call install()
1. Wait a few min
1. Developer environment with application server, identity provider, database and more is now installed and configured.

## Installation
```
npm install developer-environment --save
```

## Usage
```javascript
const devEnv = require("developer-environment");

const conf = {
    cwd: "envDir",                          //Optional | Default value => process.cwd()
    binaries: {
        wildfly: {
            version: "20.0.1.Final",        //Required
            debugPort: 8787,                //Optional | <= Default value
            portOffset: 0,                  //Optional | <= Default value
            username: "admin",              //Optional | <= Default value
            password: "password",           //Optional | <= Default value
            datasource: "MyDS",             //Optional | Default value => null
            memory: {
                Xms: "64m",                 //Optional | <= Default value
                Xmx: "2048m",               //Optional | <= Default value
                MetaspaceSize: "96M",       //Optional | <= Default value
                MaxMetaspaceSize: "1024m"   //Optional | <= Default value
            },            
            systemProperties: {             //Optional | Default value => { }
                "keycloak.url": "http://localhost:8081/auth" 
            },
            secureDeployments: {
                names: [ "my-app.war" ],    //Optional | Default value => [ ]
                properties: {               //Optional | Default value => { }
                    "auth-server-url": `http://localhost:8081/auth`
                }
            }
        },
        keycloak: {
            version: "11.0.0",              //Required
            portOffset: 1,                  //Optional | <= Default value
            username: "admin",              //Optional | <= Default value
            password: "password",           //Optional | <= Default value
            jsonFile: "realm.json"          //Optional | Default value => null
        },
        keycloakWildflyAdapter: {
            version: "11.0.0"               //Required
        },   
        mongodb: {
            version: "4.4.0",               //Required
            port: 27017,                    //Optional | <= Default value
            linuxDist: "ubuntu1804"         //Optional | <= Default value
        },
        mongodbDbTools: {
            version: "100.1.1",             //Required
            linuxDist: "ubuntu1804"         //Optional | <= Default value
        },
        postgresql: {
            version: "10.5-1",              //Required
            install: true,                  //Optional | <= Default value
            port: 5432,                     //Optional | <= Default value
            username: "admin",              //Optional | <= Default value
            password: "password",           //Optional | <= Default value
            db: "myDB"                      //Optional | <= Default value
        },
        jdbcPostgresql: {
            version: "42.2.5"               //Required
        }
    },
    repositories: [                         //Optional | Default value => [ ]
        {
            url: "git@github.com:AndreasArvidsson/developer-environment.git",
            cwd: __dirname
        }
    ]
};

devEnv.install(conf)
    .then(options => {
        console.log("DONE");
        //options is the config for each binary with default values added.
        console.log("Options", options);
    });
```

### Version only
If no other properties then the version is required the entire config object can be replace by the version string.    
The following two configs are equivalent.
```javascript
{
    wildfly: "20.0.1.Final"
}
{
    wildfly: {
        version: "20.0.1.Final"
    }
}
```

### Keycloak realm export
Export current keycloak realm settings as json file.
```javascript
devEnv.keycloakExport({
    version: "11.0.0",                  //Required
    realm: "MyRealm",                   //Required
    cwd: "envDir",                      //Optional | Default value => process.cwd()
    portOffset: 1,                      //Optional | <= Default value
    jsonFile: "realm.json"              //Optional | <= Default value
});
```

### Deploy to wildfly
Deploy all war files in specified dir to Wildfly.
```javascript
devEnv.deploy({
    version: "11.0.0",                  //Required
    dir: "my-app",                      //Required
    cwd: "envDir",                      //Optional | Default value => process.cwd()
    host: "localhost",                  //Optional | <= Default value
    port: 9990,                         //Optional | <= Default value
    username: "user",                   //Optional | Default value => null
    password: "password"                //Optional | Default value => null
});
```

### Un-deploy disabled
Un-deploy all disabled Wildfly deployments.
```javascript
devEnv.deploy({
    version: "11.0.0",                  //Required
    cwd: "envDir",                      //Optional | Default value => process.cwd()
    host: "localhost",                  //Optional | <= Default value
    port: 9990,                         //Optional | <= Default value
    username: "user",                   //Optional | Default value => null
    password: "password"                //Optional | Default value => null
});
```