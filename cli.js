#! /usr/bin/env node

'use strict';

const fs = require('fs');

const CFN = require('./lib/cfn');
const artifacts = require('./lib/artifacts');
const Template = require('./lib/template');

const Credentials = require('./lib/creds');

// Modes
const mode = {
    env: require('./lib/env'),
    list: require('./lib/list'),
    init: require('./lib/init'),
    info: require('./lib/info'),
    json: require('./lib/json'),
    estimate: require('./lib/estimate')
};

const argv = require('minimist')(process.argv, {
    boolean: ['help', 'version'],
    string: ['profile', 'template', 'name'],
    alias: {
        version: 'v'
    }
});

if (argv.version) {
    console.log('openaddresses-deploy@' + require('./package.json').version);
    process.exit(0);
}

if (!argv._[2] || argv._[2] === 'help' || (!argv._[2] && argv.help)) {
    console.log();
    console.log('Usage: deploy <command> [--profile <name>] [--template <path>]');
    console.log('              [--version] [--help]');
    console.log();
    console.log('Create, manage and delete Cloudformation Resouces from the CLI');
    console.log();
    console.log('Primary Subcommands:');
    console.log('    init      [--help]         Setup Credentials for a new AWS Account');
    console.log('    list      [--help]         List all stack assoc. with the current repo');
    console.log('    info      [--help]         Get information on a specific stack within the current repo');
    console.log('    create    [--help]         Create a new stack of the current repo');
    console.log('    update    [--help]         Update an existing stack of the current repo');
    console.log('    delete    [--help]         Delete an existing stack of the current repo');
    console.log('    env       [--help]         Setup AWS env vars in current shell');
    console.log();
    console.log('Additional Subcommands:');
    console.log('    estimate  [--help]         Estimate the cost of a CF Stack');
    console.log('    json      [--help]         Return the JSONified version of the CF template');
    console.log();
    console.log('[options]:');
    console.log('    --profile <name>        If there are multiple AWS profiles set up, the profile to deploy');
    console.log('                              with must be defined either via a .deploy file or via this flag');
    console.log('    --name <stack>          Override the default naming conventions of substacks');
    console.log('    --template <path>       The master template should be found at "cloudformation/<repo-name>.template.js(on)"');
    console.log('                              if the project has multiple CF Templates, they can be deployed by specifying');
    console.log('                              their location with this flag. The stack will be named:');
    console.log('                              <repo>-<stack name>-<template name>');
    console.log('    --version, -v           Displays version information');
    console.log('    --help                  Prints this help message');
    console.log();
    process.exit(0);
}

const command = argv._[2];

if (command === 'create' && argv.help) {
    console.log();
    console.log('Usage: deploy create <STACK>');
    console.log();
    console.log('Create new AWS resource from a CF Template');
    console.log('template should be in the following location:');
    console.log('  cloudformation/<reponame>.template.json');
    console.log('  cloudformation/<reponame>.template.js');
    console.log();
    process.exit(0);
} else if (command === 'update' && argv.help) {
    console.log();
    console.log('Usage: deploy update <STACK>');
    console.log();
    process.exit(0);
} else if (command === 'json' && argv.help) {
    console.log();
    console.log('Usage: deploy json');
    console.log();
    process.exit(0);
} else if (command === 'delete' && argv.help) {
    console.log();
    console.log('Usage: deploy delete <STACK>');
    console.log();
    process.exit(0);
} else if (mode[command] && argv.help) {
    mode[command].help();
    process.exit(0);
} else if (argv.help) {
    console.error('Subcommand not found!');
    process.exit(1);
}

main();

async function main() {
    if (['create', 'update', 'delete'].indexOf(command) > -1) {
        if (!argv._[3] && !argv.name) {
            console.error(`Stack name required: run deploy ${command} --help`);
            process.exit(1);
        }

        const creds = new Credentials(argv, {});
        await creds.template.build(creds.tags);

        const gh = new (require('./lib/gh'))(creds);

        const cf = new CFN(creds);

        const cf_path = `/tmp/${hash()}.json`;

        fs.writeFileSync(cf_path, JSON.stringify(creds.template.json, null, 4));

        if (['create', 'update'].includes(command)) {
            try {
                await artifacts(creds);
            } catch (err) {
                return console.error(`Artifacts Check Failed: ${err.message}`);
            }

            if (creds.github) await gh.deployment(argv._[3]);
        }

        if (command === 'create') {
            try {
                await cf.create(creds.name, cf_path, {
                    parameters: {
                        GitSha: creds.sha
                    }
                });

                fs.unlinkSync(cf_path);

                if (creds.github) await gh.deployment(argv._[3], true);
            } catch (err) {
                console.error(`Create failed: ${err.message}`);
                if (creds.github) await gh.deployment(argv._[3], false);
            }
        } else if (command === 'update') {
            try {
                await cf.update(creds.name, cf_path, {
                    parameters: {
                        GitSha: creds.sha
                    }
                });

                fs.unlinkSync(cf_path);
            } catch (err) {
                console.error(`Update failed: ${err.message}`);

                if (err && creds.github && err.execution === 'UNAVAILABLE' && err.status === 'FAILED') {
                    await gh.deployment(argv._[3], true);
                } else if (creds.github) {
                    await gh.deployment(argv._[3], false);
                }
            }
        } else if (command === 'delete') {
            try {
                await cf.delete(creds.name);
                fs.unlinkSync(cf_path);
            } catch (err) {
                console.error(`Delete failed: ${err.message}`);
            }
        }
    } else if (mode[command]) {
        if (['init'].includes(command)) {
            mode[command].main(process.argv);
        } else if (['json', 'estimate'].includes(command)) {

            const creds = new Credentials(argv, {
                template: true
            });
            await creds.template.build(creds.tags);

            mode[command].main(creds, process.argv);
        } else {
            const creds = new Credentials(argv, {
                template: false
            });

            mode[command].main(creds, process.argv);
        }
    } else {
        console.error('Subcommand not found!');
        process.exit(1);
    }
}

function hash() {
    return Math.random().toString(36).substring(2, 15);
}
