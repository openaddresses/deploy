import mode from './commands.js';

export default class Help {
    static main(): never {
        console.log();
        console.log('Usage: deploy <command> [--profile <name>] [--template <path>]');
        console.log('              [--version] [--help]');
        console.log();
        console.log('Create, manage and delete CloudFormation resources from the CLI');
        console.log();
        console.log('Subcommands:');
        for (const name of Object.keys(mode)) {
            console.log(`    ${name.padEnd(12)} [--help]        ${mode[name].short}`);
        }
        console.log();
        console.log('[options]:');
        console.log('    --region  <region>      Override default region to perform operations in');
        console.log('    --profile <name>        If there are multiple AWS profiles set up, the profile to deploy');
        console.log('                              with must be defined either via a .deploy file or via this flag');
        console.log('    --name <stack>          Override the default naming conventions of substacks');
        console.log('    --template <path>       The master template should be found at "cloudformation/<repo-name>.template.js(on)"');
        console.log('                              if the project has multiple CF templates, they can be deployed by specifying');
        console.log('                              their location with this flag. The stack will be named:');
        console.log('                              <repo>-<stack name>-<template name>');
        console.log('    --version, -v           Displays version information');
        console.log('    --help                  Prints this help message');
        console.log();
        process.exit(0);
    }
}
