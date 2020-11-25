'use strict';

const Table = require('cli-table');
const minimist = require('minimist');
const cf = require('@mapbox/cfn-config');

/**
 * @class Info
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

        cf.lookup.info(`${creds.repo}-${stack}`, creds.region, true, false, (err, info) => {
            if (err) throw err;

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
