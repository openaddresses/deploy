#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import minimist from 'minimist';
import inquirer from 'inquirer';
import Git from './lib/git.js';
import Help from './lib/help.js';

import GH from './lib/gh.js';
import Context from './lib/context.js';
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
    process.exit(0);
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

try {
    await main();
} catch (err) {
    console.error(`Unknown Error: ${err.message}`);
    if (argv.debug) throw err;
}

async function main() {
    if (['create', 'update', 'delete', 'cancel'].indexOf(command) > -1) {
        const context = await Context.generate(argv);

        if (!argv._[3] && !argv.name) {
            console.error(`Stack name required: run deploy ${command} --help`);
            process.exit(1);
        }

        const gh = new GH(context);

        // Ensure config & template buckets exist
        await mode.init.bucket(context);

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
                await artifacts(context);
            } catch (err) {
                console.error(`Artifacts Check Failed: ${err.message}`);
                if (argv.debug) throw err;
                process.exit(1);
            }

            if (context.github) await gh.deployment(argv._[3]);

            if (context.tags && ['create', 'update'].includes(command)) {
                let existingTemplate = null;

                if (command === 'update') existingTemplate = await context.cfn.lookup.info(`${context.repo}-${context.name}`, context.region, true, false);

                context.cfn.commands.config.tags = await Tags.request(context, existingTemplate);
            }
        }

        const template = await context.cfn.template.read(new URL(path.resolve(process.cwd(), context.template), 'file://'));
        const cf_path = `/tmp/${hash()}.json`;

        fs.writeFileSync(cf_path, JSON.stringify(template.body, null, 4));

        const parameters = new Map([
            ['GitSha', context.sha]
        ]);
        if (command === 'create') {
            try {
                await context.cfn.commands.create(context.name, cf_path, { parameters });

                fs.unlinkSync(cf_path);

                if (context.github) await gh.deployment(argv._[3], true);
            } catch (err) {
                console.error(`Create failed: ${err.message}`);
                if (context.github) await gh.deployment(argv._[3], false);
                if (argv.debug) throw err;
            }
        } else if (command === 'update') {
            try {
                await context.cfn.commands.update(context.name, cf_path, { parameters });

                fs.unlinkSync(cf_path);
            } catch (err) {
                console.error(`Update failed: ${err.message}`);

                if (err && context.github && err.execution === 'UNAVAILABLE' && err.status === 'FAILED') {
                    await gh.deployment(argv._[3], true);
                } else if (context.github) {
                    await gh.deployment(argv._[3], false);
                }
                if (argv.debug) throw err;
            }
        } else if (command === 'delete') {
            try {
                await context.cfn.commands.delete(context.name);
                fs.unlinkSync(cf_path);
            } catch (err) {
                console.error(`Delete failed: ${err.message}`);
                if (argv.debug) throw err;
            }
        } else if (command === 'cancel') {
            try {
                await context.cfn.commands.cancel(context.name);
                fs.unlinkSync(cf_path);

                if (context.github) await gh.deployment(argv._[3], false);
            } catch (err) {
                console.error(`Cancel failed: ${err.message}`);
                if (argv.debug) throw err;
            }
        }
    } else if (mode[command]) {
        if (['init'].includes(command)) {
            mode[command].main(process.argv);
        } else if (['env'].includes(command)) {
            argv.template = false;
            const context = await Context.generate(argv);
            mode[command].main(context, process.argv);
        } else {
            const context = await Context.generate(argv);

            try {
                await mode[command].main(context, process.argv);
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
