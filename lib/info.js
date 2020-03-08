const Table = require('cli-table');
const minimist = require('minimist');
const cf = require('@mapbox/cfn-config');
const AWS = require('aws-sdk');

class Info {
    static help() {
        console.log()
        console.log('Get info about a specific stack in the current repo');
        console.log();
        console.log('Usage: deploy info [--output] [--help]');
        console.log();
        console.log('Options:')
        console.log('  --outputs        print stack outputs in a table');
        console.log('  --help           show this help message');
        console.log();
    }

    static main(creds, argv) {
        argv = minimist(argv, {
            boolean: ['output'],
            alias: {
                output: 'outputs'
            }
        });

        const cloudformation = new AWS.CloudFormation({
            region: creds.region
        });

        if (!argv._[3]) return console.error(`Stack name required: run deploy info --help`);

        const stack = argv._[3];

        cf.lookup.info(`${creds.repo}-${stack}`, creds.region, true, false, (err, info) => {
            if (err) throw err;

            if (argv.output) {
                const table = new Table({
                    head: ['Name', 'Value']
                });

                for (const output of Object.keys(info.Outputs)) {
                    table.push([output, info.Outputs[output]]);
                }

                console.log();
                console.log('Outputs:')
                console.log(table.toString());
                console.log();
            } else {
                console.log(JSON.stringify(info, null, 4));
            }
        });
    }
}

module.exports = Info;
