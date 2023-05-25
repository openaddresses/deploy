import Table from 'cli-table';
import minimist from 'minimist';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

/**
 * @class
 */
export default class Info {
    static short = 'Get information on a specific stack within the current repo';

    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Get info about a specific stack in the current repo');
        console.log();
        console.log('Usage: deploy info <stack> [--output|-o] [--parameters|-p] [--help]');
        console.log();
        console.log('Options:');
        console.log('  --outputs            Print stack outputs in a table');
        console.log('  --parameters         Print stack parameters in a table');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }

    /**
     * Obtain information about a given stack
     *
     * @param {Context} context Context
     * @param {Object} argv Program arguments
     */
    static async main(context, argv) {
        argv = minimist(argv, {
            boolean: ['output', 'parameters', 'help'],
            alias: {
                output: 'outputs',
                parameters: 'parameter'
            }
        });

        if (!context.stack) return console.error('Stack name required: run deploy info --help');

        const sm = new SecretsManagerClient({
            credentials: context.aws,
            region: context.region
        });

        const info = await context.cfn.lookup.info(`${context.repo}-${context.stack}`, context.region, true, false);

        for (const key of info.Outputs.keys()) {
            if (!info.Outputs.get(key).match(/{{resolve:secretsmanager:.*}}/)) continue;

            for (const match of info.Outputs.get(key).match(/{{resolve:secretsmanager:.*?}}/g)) {
                const parsed = match.replace(/{{resolve:secretsmanager:/, '').replace(/}}/, '').split(':');
                if (!parsed[0]) throw new Error('Secret Name Missing in resolve');
                if (!parsed[1]) parsed[1] = 'SecretString';
                if (!parsed[2]) parsed[2] = '';
                if (!parsed[3]) parsed[3] = 'AWSCURRENT';

                let val = await sm.send(new GetSecretValueCommand({
                    SecretId: parsed[0],
                    VersionStage: parsed[3]
                }));

                if (!parsed[2]) {
                    val = val.SecretString;
                } else {
                    val = JSON.parse(val.SecretString)[parsed[2]];
                }

                info.Outputs.set(key, info.Outputs.get(key).replace(match, val));
            }
        }

        if (argv.parameter) {
            this.table('Parameters', Object.fromEntries(info.Parameters));
        }

        if (argv.output) {
            this.table('Outputs', Object.fromEntries(info.Outputs));
        }

        if (!argv.output && !argv.parameter) {
            console.log(JSON.stringify(info, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (value.dataType === 'Map') {
                        return new Map(value.value);
                    }
                }
                return value;
            }, 4));
        }
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
