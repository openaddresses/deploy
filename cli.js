#! /usr/bin/env node

import fs from 'fs';
import friend from '@mapbox/cloudfriend';
import CFN from '@openaddresses/cfn-config';
import minimist from 'minimist';

import GH from './lib/gh.js';
import Credentials from './lib/creds.js';
import artifacts from './lib/artifacts.js';
import tagger from './lib/tagger.js';
import env from './lib/env.js';
import list from './lib/list.js';
import init from './lib/init.js';
import info from './lib/info.js';
import json from './lib/json.js';

// Modes
const mode = {
    env, list, init, info, json
};

const argv = minimist(process.argv, {
    boolean: ['help', 'version'],
    string: ['profile', 'template', 'name'],
    alias: {
        version: 'v'
    }
});

if (argv.version) {
    console.log('openaddresses-deploy@' + JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url))).version);
    process.exit(0);
}

if (!argv._[2] || argv._[2] === 'help' || (!argv._[2] && argv.help)) {
    console.log();
    console.log('Usage: deploy <command> [--profile <name>] [--template <path>]');
    console.log('              [--version] [--help]');
    console.log();
    console.log('Create, manage and delete Cloudformation Resouces from the CLI');
    console.log();
    console.log('Subcommands:');
    console.log('    init      [--help]         Setup Credentials for a new AWS Account');
    console.log('    list      [--help]         List all stack assoc. with the current repo');
    console.log('    info      [--help]         Get information on a specific stack within the current repo');
    console.log('    create    [--help]         Create a new stack of the current repo');
    console.log('    update    [--help]         Update an existing stack of the current repo');
    console.log('    delete    [--help]         Delete an existing stack of the current repo');
    console.log('    json      [--help]         Return the JSONified version of the CF template');
    console.log('    env       [--help]         Setup AWS env vars in current shell');
    console.log();
    console.log('[options]:');
    console.log('    --region  <region>      Override default region to perform operations in');
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
        const gh = new GH(creds);

        const cfn = CFN.preauth(creds);

        // Ensure config & template buckets exist
        await mode.init.bucket(creds);

        const cf = new cfn.Commands({
            name: creds.repo,
            region: creds.region,
            configBucket: `cfn-config-active-${creds.accountId}-${creds.region}`,
            templateBucket: `cfn-config-templates-${creds.accountId}-${creds.region}`
        });

        let template = await friend.build(creds.template);
        const cf_path = `/tmp/${hash()}.json`;

        template = tagger(template, creds.tags);

        fs.writeFileSync(cf_path, JSON.stringify(template, null, 4));

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
        } else if (['json'].includes(command)) {
            const creds = new Credentials(argv, {
                template: true
            });

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
