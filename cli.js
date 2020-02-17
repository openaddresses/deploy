#! /usr/bin/env node

const fs = require('fs');
const cf = require('@mapbox/cfn-config');
const AWS = require('aws-sdk');
const friend = require('@mapbox/cloudfriend');
const path = require('path');
const prompt = require('prompt');
const cp = require('child_process');
const argv = require('minimist')(process.argv, {
    boolean: ['help']
});

if (!argv._[2] || argv.help) {
    console.log();
    console.log('usage: deploy <command> [--version] [--help]');
    console.log()
    console.log('Create, manage and delete Cloudformation Resouces from the CLI');
    console.log();
    console.log('<command>:');
    console.log('    init      [--help]         Setup Credentials for using OA CLI');
    console.log('    list      [--help]         List all stack assoc. with the current repo');
    console.log('    info      [--help]         Get information on a specific stack within the current repo');
    console.log('    create    [--help]         Create a new stack of the current repo');
    console.log('    update    [--help]         Update an existing stack of the current repo');
    console.log('    delete    [--help]         Delete an existing stack of the current repo');
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
    console.log('usage deploy create <STACK>');
    console.log();
    console.log('Create new AWS resource from a CF Template');
    console.log('template should be in the following location:');
    console.log('  cloudformation/<reponame>.template.json');
    console.log('  cloudformation/<reponame>.template.js');
    console.log();
    process.exit();
} else if (command === 'update' && argv.help) {
    console.log();
    console.log('usage deploy update <STACK>');
    console.log()
    process.exit();
} else if (command === 'delete' && argv.help) {
    console.log();
    console.log('usage deploy delete <STACK>');
    console.log()
    process.exit();
} else if (command === 'list' && argv.help) {
    console.log();
    console.log('usage deploy list');
    console.log();
    console.error('List all of the currently running stacks deployed from the current repo');
    console.log()
} else if (command === 'info' && argv.help) {
    console.log();
    console.log('usage deploy info');
    console.log();
    console.error('Get info about a specific stack in the current repo');
    console.log()
}

const repo = path.parse(path.resolve('.')).name;

if (command === 'init') {
    prompt.message = '$';
    prompt.start();

    prompt.get([{
        name: 'region',
        type: 'string',
        required: true,
        default: 'us-east-1'
    },{
        name: 'accountId',
        type: 'string',
        required: true
    },{
        name: 'accessKeyId',
        type: 'string',
        required: true
    },{
        name: 'secretAccessKey',
        hidden: true,
        replace: '*',
        required: true,
        type: 'string'
    }], (err, argv) => {
        if (err) return console.error(`deploy init failed: ${err.message}`);

        fs.writeFileSync(path.resolve(process.env.HOME, '.deployrc.json'), JSON.stringify(argv, null, 4));
    });
} else if (['create', 'update', 'delete'].indexOf(command) > -1) {
    if (!argv._[3]) return console.error(`Stack name required: run deploy ${command} --help`);
    const stack = argv._[3];

    const creds = loadCreds()

    const cf_cmd = cf.commands({
        name: repo,
        region: creds.region,
        configBucket: `cfn-config-active-${creds.accountId}-${creds.region}`,
        templateBucket: `cfn-config-templates-${creds.accountId}-${creds.region}`
    });

    let cf_base = `${repo}.template`
    let cf_path = false;
    for (let file of fs.readdirSync(path.resolve('./cloudformation/'))) {
        if (file.indexOf(cf_base) === -1) continue;

        const ext = path.parse(file).ext;
        if (ext === '.js' || ext === '.json') {
            cf_path = path.resolve('./cloudformation/', file);
            break;
        }
    }

    if (!cf_path) return console.error(`Could not find CF Template in cloudformation/${repo}.template.js(on)`);

    friend.build(cf_path).then(template => {
        cf_path = `/tmp/${cf_base}.json`;
        fs.writeFileSync(cf_path, JSON.stringify(template, null, 4));

        if (command === 'create') {
            checkImage(template, (err, sha) => {
                if (err) return console.error(`Docker Image Check Failed: ${err.message}`);

                cf_cmd.create(stack, cf_path, {
                    parameters: {
                        GitSha: sha
                    }
                }, (err) => {
                    if (err) return console.error(`Create failed: ${err.message}`);
                    fs.unlinkSync(cf_path);
                });
            });
        } else if (command === 'update') {
            checkImage(template, (err, sha) => {
                if (err) return console.error(`Docker Image Check Failed: ${err.message}`);

                cf_cmd.update(stack, cf_path, {
                    parameters: {
                        GitSha: sha
                    }
                }, (err) => {
                    if (err) return console.error(`Update failed: ${err.message}`);
                    fs.unlinkSync(cf_path);
                });
            });
        } else if (command === 'delete') {
            cf_cmd.delete(stack, (err) => {
                if (err) return console.error(`Delete failed: ${err.message}`);
                fs.unlinkSync(cf_path);
            });
        }
    });
} else if (command === 'list') {
    loadCreds();

    const cloudformation = new AWS.CloudFormation({
        region: 'us-east-1'
    });

    cloudformation.listStacks({
        // All but "DELETE_COMPLETE"
        StackStatusFilter: [
          'CREATE_IN_PROGRESS',
          'CREATE_FAILED',
          'CREATE_COMPLETE',
          'ROLLBACK_IN_PROGRESS',
          'ROLLBACK_FAILED',
          'ROLLBACK_COMPLETE',
          'DELETE_IN_PROGRESS',
          'DELETE_FAILED',
          'UPDATE_IN_PROGRESS',
          'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
          'UPDATE_COMPLETE',
          'UPDATE_ROLLBACK_IN_PROGRESS',
          'UPDATE_ROLLBACK_FAILED',
          'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
          'UPDATE_ROLLBACK_COMPLETE'
        ]
    }, (err, res) => {
        if (err) throw err;

        for (let stack of res.StackSummaries) {
            if (stack.StackName.match(new RegExp(`^${repo}-`))) {
                console.error(stack.StackName, stack.StackStatus, stack.CreationTime);
            }
        }
    });

} else if (command === 'info') {
    const creds = loadCreds();

    const cloudformation = new AWS.CloudFormation({
        region: 'us-east-1'
    });

    if (!argv._[3]) return console.error(`Stack name required: run deploy ${command} --help`);
    const stack = argv._[3];

    cf.lookup.info(`${repo}-${stack}`, creds.region, true, false, (err, info) => {
        if (err) throw err;

        console.log(JSON.stringify(info, null, 4));
    });
}

function checkImage(template, cb) {
    let retries = 0;
    const maxRetries = 5;

    if (!template.Parameters.GitSha) return cb();

    const git = cp.spawnSync('git', [
        '--git-dir', path.resolve('.', '.git'),
        'rev-parse', 'HEAD'
    ]);

    if (!git.stdout) return cb(new Error('Is this a git repo? Could not determine GitSha'));
    const sha = String(git.stdout).replace(/\n/g, '');

    check();

    function check() {
        const ecr = new AWS.ECR({ region: 'us-east-1' });

        ecr.batchGetImage({
            imageIds: [{ imageTag: sha  }],
            repositoryName: repo
        }, (err, data) => {
            if (err) return cb(err);

            if (data && data.images.length) {
                return cb(null, sha);
            } else if (retries < maxRetries) {
                if (retries === 0) console.log(`Waiting for Docker Image: AWS::ECR: ${repo}/${sha}`);
                retries += 1;
                setTimeout(check, 2000);
            } else {
                return cb(new Error('No image found for commit ' + sha ));
            }
        });
    }
}

function loadCreds() {
    try {
        AWS.config.loadFromPath(path.resolve(process.env.HOME, '.deployrc.json'));
    } catch (err) {
        console.error('creds not set: run deploy init');
        process.exit(1);
    }

    const creds = JSON.parse(fs.readFileSync(path.resolve(process.env.HOME, '.deployrc.json')));
    cf.preauth(creds);

    return creds;
}
