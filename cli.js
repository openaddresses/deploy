#! /usr/bin/env node

const fs = require('fs');
const cf = require('@mapbox/cfn-config');
const path = require('path');
const prompt = require('prompt');
const argv = require('minimist')(process.argv, {
    boolean: ['help']
});

if (!argv._[2] || argv.help) {
    console.log();
    console.log('usage: oa <command> [--version] [--help]');
    console.log()
    console.log('Create, manage and delete OpenAddresses Cloud Resouces from the CLI');
    console.log();
    console.log('<command>:');
    console.log('    init      [--help]         Setup Credentials for using OA CLI');
    console.log('    create    [--help]         Create a new stack');
    console.log('    update    [--help]         Update an existing stack');
    console.log('    delete    [--help]         Delete an existing stack');
    console.log();
    console.log('[options]:');
    console.log('    --version, -v           Displays version information');
    console.log('    --help                  Prints this help message');
    console.log();
    process.exit();
}

const command = argv._[2];

if (command === 'create' && argv.help) {
    console.log();
    console.log('usage oa create <STACK>');
    console.log();
    console.log('Create new AWS resource from a CF Template');
    console.log('template should be in the following location:');
    console.log('  cloudformation/<reponame>.template.json');
    console.log();
}

if (command === 'update' && argv.help) {
    console.log();
    console.log('usage oa update <STACK>');
    console.log()
}

if (command === 'delete' && argv.help) {
    console.log();
    console.log('usage oa delete <STACK>');
    console.log()
}

if (command === 'init') {
    prompt.message = '$';
    prompt.start();

    prompt.get([{
        name: 'AWS_DEFAULT_REGION',
        type: 'string',
        required: true,
        default: 'us-east-1'
    },{
        name: 'AWS_ACCOUNT_ID',
        type: 'string',
        required: true
    },{
        name: 'AWS_ACCESS_KEY_ID',
        type: 'string',
        required: true
    },{
        name: 'AWS_SECRET_ACCESS_KEY',
        hidden: true,
        replace: '*',
        required: true,
        type: 'string'
    }], (err, argv) => {
        if (err) return console.error(`oa init failed: ${err.message}`);

        fs.writeFileSync(path.resolve(process.env.HOME, '.oarc.json'), JSON.stringify(argv, null, 4));

    });
}

if (['create', 'update', 'delete'].indexOf(command) > -1) {
    if (!argv._[3]) return console.error(`Stack name required: run oa ${command} --help`);
    const stack = argv._[3];
    const repo = path.parse(path.resolve('.')).name;

    fs.readFile(path.resolve(process.env.HOME, '.oarc.json'), (err, creds) => {
        if (err) return console.error('creds not found: run oa init');
        creds = JSON.parse(creds);

        for (let key of Object.keys(creds)) process.env[key] = creds[key];

        const cf_cmd = cf.commands({
            name: repo,
            region: creds.AWS_DEFAULT_REGION,
            templatePath: path.resolve(`./cloudformatioe/${repo}.template.json`),
            configBucket: `cfn-config-active-${creds.AWS_ACCOUNT_ID}-${creds.AWS_DEFAULT_REGION}`,
            templateBucket: `cfn-config-templates-${creds.AWS_ACCOUNT_ID}-${creds.AWS_DEFAULT_REGION}`
        })

        if (command === 'create') {

        } else if (command === 'update') {

        } else if (command === 'delete') {
            cf_cmd.delete(stack, (err) => {
                if (err) return console.error(`Delete failed: ${err.message}`);
            });
        }
    });
}
