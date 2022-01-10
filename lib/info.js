'use strict';

const Table = require('cli-table');
const minimist = require('minimist');
const cf = require('@mapbox/cfn-config');
const AWS = require('aws-sdk');

/**
 * @class
 */
class Info {
    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Get info about a specific stack in the current repo');
        console.log();
        console.log('Usage: deploy info [--output|-o] [--parameters|-p] [--help]');
        console.log();
        console.log('Options:');
        console.log('  --outputs        print stack outputs in a table');
        console.log('  --parameters     print stack parameters in a table');
        console.log('  --help           show this help message');
        console.log();
    }

    /**
     * Obtain information about a given stack
     *
     * @param {Credentials} creds Credentials
     * @param {Object} argv Program arguments
     */
    static main(creds, argv) {
        argv = minimist(argv, {
            boolean: ['output', 'parameters'],
            alias: {
                output: 'outputs',
                parameters: 'parameter'
            }
        });

        if (!argv._[3]) return console.error('Stack name required: run deploy info --help');

        const stack = argv._[3];

        const sm = new AWS.SecretsManager({
            region: creds.region
        });

        cf.lookup.info(`${creds.repo}-${stack}`, creds.region, true, false, async (err, info) => {
            if (err) throw err;

            for (const key of Object.keys(info.Outputs)) {
                if (!info.Outputs[key].match(/{{resolve:secretsmanager:.*}}/)) continue;

                for (const match of info.Outputs[key].match(/{{resolve:secretsmanager:.*?}}/g)) {
                    const parsed = match.replace(/{{resolve:secretsmanager:/, '').replace(/}}/, '').split(':');
                    if (!parsed[0]) throw new Error('Secret Name Missing in resolve');
                    if (!parsed[1]) parsed[1] = 'SecretString';
                    if (!parsed[2]) parsed[2] = '';
                    if (!parsed[3]) parsed[3] = 'AWSCURRENT';

                    let val = await sm.getSecretValue({
                        SecretId: parsed[0],
                        VersionStage: parsed[3]
                    }).promise();

                    if (!parsed[2]) {
                        val = val.SecretString;
                    } else {
                        val = JSON.parse(val.SecretString)[parsed[2]];
                    }

                    info.Outputs[key] = info.Outputs[key].replace(match, val);
                }
            }

            if (argv.parameter) {
                this.table('Parameters', info.Parameters);
            }

            if (argv.output) {
                this.table('Outputs', info.Outputs);
            }

            if (!argv.output && !argv.parameter) {
                console.log(JSON.stringify(info, null, 4));
            }
        });
    }

    /**
     * Pretty print an object to the screen
     *
     * @param {string} name Title of chart
     * @param {Object} kv Key/Value Object to print to screen
     */
    static table(name, kv) {
        const table = new Table({
            head: ['Name', 'Value']
        });

        for (const output of Object.keys(kv)) {
            table.push([output, kv[output]]);
        }

        console.log();
        console.log(`${name}:`);
        console.log(table.toString());
        console.log();
    }
}

module.exports = Info;
