#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseArgs } from 'node:util';
import artifacts from './lib/artifacts.js';
import mode from './lib/commands.js';
import Context from './lib/context.js';
import GH from './lib/gh.js';
import Git from './lib/git.js';
import Help from './lib/help.js';
import Tags from './lib/tags.js';
import type { DeployArgv } from './lib/types.js';

const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
        help: { type: 'boolean' },
        version: { type: 'boolean', short: 'v' },
        debug: { type: 'boolean' },
        force: { type: 'boolean' },
        profile: { type: 'string' },
        region: { type: 'string' },
        template: { type: 'string' },
        name: { type: 'string' }
    },
    allowPositionals: true,
    strict: false
});
const argv = { ...values, _: positionals } as DeployArgv;

if (argv.version) {
    const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
    console.log(`openaddresses-deploy@${packageJson.version}`);
    process.exit(0);
}

if (!argv._[0] || argv._[0] === 'help' || (!argv._[0] && argv.help)) {
    Help.main();
}

const command = String(argv._[0]);

if (mode[command] && argv.help) {
    mode[command].help();
    process.exit(0);
} else if (argv.help) {
    console.error('Subcommand not found!');
    process.exit(1);
}

try {
    await main();
} catch (error) {
    const err = asError(error);
    console.error(`Unknown Error: ${err.message}`);
    if (argv.debug) {
        throw err;
    }
}

async function main(): Promise<void> {
    if (['create', 'update', 'delete', 'cancel'].includes(command)) {
        const context = await Context.generate(argv);

        if (!argv._[1] && !argv.name) {
            console.error(`Stack name required: run deploy ${command} --help`);
            process.exit(1);
        }

        const gh = new GH(context);

        await mode.init.bucket?.(context);

        if (['create', 'update'].includes(command)) {
            if (Git.uncommitted()) {
                const response = await inquirer.prompt<{ uncommitted: boolean }>([{
                    type: 'confirm',
                    name: 'uncommitted',
                    default: false,
                    message: 'You have uncommitted changes. Continue?'
                }]);

                if (!response.uncommitted) {
                    return;
                }
            }

            if (!Git.pushed()) {
                const response = await inquirer.prompt<{ unpushed: boolean }>([{
                    type: 'confirm',
                    name: 'unpushed',
                    default: false,
                    message: 'You have commits that have not been pushed. Continue?'
                }]);

                if (!response.unpushed) {
                    return;
                }
            }

            try {
                await artifacts(context);
            } catch (error) {
                const err = asError(error);
                console.error(`Artifacts Check Failed: ${err.message}`);
                if (argv.debug) {
                    throw err;
                }
                process.exit(1);
            }

            if (context.github) {
                await gh.deployment(String(argv._[1] ?? context.name));
            }

            if (context.tags.length > 0) {
                let existingTemplate = null;

                if (command === 'update') {
                    existingTemplate = await context.cfn.lookup.info(`${context.repo}-${context.name}`);
                }

                context.cfn.commands.config.tags = await Tags.request(context, existingTemplate);
            }
        }

        if (!context.template) {
            throw new Error('CloudFormation template is required for this command');
        }

        const template = await context.cfn.template.read(new URL(path.resolve(process.cwd(), context.template), 'file://'));
        const cloudFormationPath = `/tmp/${hash()}.json`;

        fs.writeFileSync(cloudFormationPath, JSON.stringify(template.body, null, 4));

        const parameters = new Map<string, string>([
            ['GitSha', context.sha]
        ]);

        if (command === 'create') {
            await runDeploymentCommand('Create failed', async () => {
                await context.cfn.commands.create(context.name, cloudFormationPath, { parameters });
                fs.unlinkSync(cloudFormationPath);

                if (context.github) {
                    await gh.deployment(String(argv._[1] ?? context.name), true);
                }
            });
        } else if (command === 'update') {
            await runDeploymentCommand('Update failed', async () => {
                await context.cfn.commands.update(context.name, cloudFormationPath, { parameters });
                fs.unlinkSync(cloudFormationPath);

                if (context.github) {
                    await gh.deployment(String(argv._[1] ?? context.name), true);
                }
            }, async (error) => {
                if (!context.github) {
                    return;
                }

                const err = error as { execution?: string; status?: string };
                if (err.execution === 'UNAVAILABLE' && err.status === 'FAILED') {
                    await gh.deployment(String(argv._[1] ?? context.name), true);
                } else {
                    await gh.deployment(String(argv._[1] ?? context.name), false);
                }
            });
        } else if (command === 'delete') {
            await runDeploymentCommand('Delete failed', async () => {
                await context.cfn.commands.delete(context.name);
                fs.unlinkSync(cloudFormationPath);
            });
        } else if (command === 'cancel') {
            await runDeploymentCommand('Cancel failed', async () => {
                await context.cfn.commands.cancel(context.name);
                fs.unlinkSync(cloudFormationPath);

                if (context.github) {
                    await gh.deployment(String(argv._[1] ?? context.name), false);
                }
            });
        }
    } else if (mode[command]) {
        if (command === 'init') {
            await mode[command].main?.(process.argv.slice(2));
        } else if (command === 'env') {
            argv.template = false;
            const context = await Context.generate(argv);
            await mode[command].main?.(context, process.argv.slice(2));
        } else {
            const context = await Context.generate(argv);

            try {
                await mode[command].main?.(context, process.argv.slice(2));
            } catch (error) {
                const err = asError(error);
                console.error(`Command failed: ${err.message}`);
                if (argv.debug) {
                    throw err;
                }
            }
        }
    } else {
        console.error('Subcommand not found!');
        process.exit(1);
    }
}

async function runDeploymentCommand(
    message: string,
    run: () => Promise<void>,
    onError?: (_error: unknown) => Promise<void>
): Promise<void> {
    try {
        await run();
    } catch (error) {
        const err = asError(error);
        console.error(`${message}: ${err.message}`);

        if (onError) {
            await onError(error);
        }

        if (argv.debug) {
            throw err;
        }
    }
}

function hash(): string {
    return Math.random().toString(36).substring(2, 15);
}

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
