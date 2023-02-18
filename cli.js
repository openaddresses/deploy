#! /usr/bin/env node

import fs from 'fs';
import CFN from '@openaddresses/cfn-config';
import minimist from 'minimist';
import inquirer from 'inquirer';
import Git from './lib/git.js';
import Help from './lib/help.js';

import GH from './lib/gh.js';
import Credentials from './lib/creds.js';
import artifacts from './lib/artifacts.js';
import Tags from './lib/tags.js';
import mode from './lib/commands.js';

const argv = minimist(process.argv, {
    boolean: ['help', 'version', 'debug'],
    string: ['profile', 'template', 'name'],
    alias: {
        version: 'v'
    }
});

if (argv.version) {
    console.log('openaddresses-deploy@' + JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url))).version);
}

if (!argv._[2] || argv._[2] === 'help' || (!argv._[2] && argv.help)) Help.main();

const command = argv._[2];

if (mode[command] && argv.help) {
    mode[command].help();
    process.exit(0);
} else if (argv.help) {
    console.error('Subcommand not found!');
    process.exit(1);
}

main();

async function main() {
    if (['create', 'update', 'delete', 'cancel'].indexOf(command) > -1) {
        if (!argv._[3] && !argv.name) {
            console.error(`Stack name required: run deploy ${command} --help`);
            process.exit(1);
        }

        const creds = await Credentials.generate(argv, {});
        const gh = new GH(creds);

        let tags = [];

        // Ensure config & template buckets exist
        await mode.init.bucket(creds);

        if (['create', 'update'].includes(command)) {
            if (Git.uncommitted()) {
                const res = await inquirer.prompt([{
                    type: 'boolean',
                    name: 'uncommitted',
                    default: 'N',
                    message: 'You have uncommitted changes! Continue? (y/N)'
                }]);

                if (res.uncommitted.toLowerCase() !== 'y') return;
            }

            if (!Git.pushed()) {
                const res = await inquirer.prompt([{
                    type: 'boolean',
                    name: 'unpushed',
                    default: 'N',
                    message: 'You have commits that haven\'t been pushed! Continue? (y/N)'
                }]);

                if (res.unpushed.toLowerCase() !== 'y') return;
            }

            try {
                await artifacts(creds);
            } catch (err) {
                return console.error(`Artifacts Check Failed: ${err.message}`);
                if (argv.debug) throw err;
            }

            if (creds.github) await gh.deployment(argv._[3]);

            if (creds.tags && ['create', 'update'].includes(command)) {
                tags = await Tags.request(creds.tags);
            }
        }

        const cfn = new CFN({
            region: creds.region,
            credentials: creds.aws
        },{
            tags,
            name: creds.repo,
            configBucket: `cfn-config-active-${await creds.accountId()}-${creds.region}`,
            templateBucket: `cfn-config-templates-${await creds.accountId()}-${creds.region}`
        });

        const template = await cfn.template.read(new URL(creds.template, 'file://'));
        const cf_path = `/tmp/${hash()}.json`;

        fs.writeFileSync(cf_path, JSON.stringify(template.body, null, 4));

        const parameters = new Map([
            ['GitSha', creds.sha]
        ]);
        if (command === 'create') {
            try {
                await cfn.commands.create(creds.name, cf_path, { parameters });

                fs.unlinkSync(cf_path);

                if (creds.github) await gh.deployment(argv._[3], true);
            } catch (err) {
                console.error(`Create failed: ${err.message}`);
                if (creds.github) await gh.deployment(argv._[3], false);
                if (argv.debug) throw err;
            }
        } else if (command === 'update') {
            try {
                await cfn.commands.update(creds.name, cf_path, { parameters });

                fs.unlinkSync(cf_path);
            } catch (err) {
                console.error(`Update failed: ${err.message}`);

                if (err && creds.github && err.execution === 'UNAVAILABLE' && err.status === 'FAILED') {
                    await gh.deployment(argv._[3], true);
                } else if (creds.github) {
                    await gh.deployment(argv._[3], false);
                }
                if (argv.debug) throw err;
            }
        } else if (command === 'delete') {
            try {
                await cfn.commands.delete(creds.name);
                fs.unlinkSync(cf_path);
            } catch (err) {
                console.error(`Delete failed: ${err.message}`);
                if (argv.debug) throw err;
            }
        } else if (command === 'cancel') {
            try {
                await cfn.commands.cancel(creds.name);
                fs.unlinkSync(cf_path);

                if (creds.github) await gh.deployment(argv._[3], false);
            } catch (err) {
                console.error(`Cancel failed: ${err.message}`);
                if (argv.debug) throw err;
            }
        }
    } else if (mode[command]) {
        if (['init'].includes(command)) {
            mode[command].main(process.argv);
        } else {
            try {
                const creds = await Credentials.generate(argv, {
                    template: false
                });

                await mode[command].main(creds, process.argv);
            } catch (err) {
                console.error(`Command failed: ${err.message}`);
                if (argv.debug) throw err;
            }
        }
    } else {
        console.error('Subcommand not found!');
        process.exit(1);
    }
}

function hash() {
    return Math.random().toString(36).substring(2, 15);
}
