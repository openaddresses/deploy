#! /usr/bin/env node

const fs = require('fs');
const artifacts = require('./lib/artifacts');
const schema = require('./data/cf_schema.json');
const cf = require('@mapbox/cfn-config');
const AWS = require('aws-sdk');
const friend = require('@mapbox/cloudfriend');
const path = require('path');
const prompt = require('prompt');
const cp = require('child_process');

// Modes
const mode = {
    info: require('./lib/info')
}

const argv = require('minimist')(process.argv, {
    boolean: ['help']
});

if (!argv._[2] || argv._[2] === 'help' || argv.help) {
    console.log();
    console.log('usage: deploy <command> [--profile] [--version] [--help]');
    console.log()
    console.log('Create, manage and delete Cloudformation Resouces from the CLI');
    console.log();
    console.log('<command>:');
    console.log('    init      [--help]         Setup Credentials for a new AWS Account');
    console.log('    list      [--help]         List all stack assoc. with the current repo');
    console.log('    info      [--help]         Get information on a specific stack within the current repo');
    console.log('    create    [--help]         Create a new stack of the current repo');
    console.log('    update    [--help]         Update an existing stack of the current repo');
    console.log('    delete    [--help]         Delete an existing stack of the current repo');
    console.log('    env       [--help]         Setup AWS env vars in current shell');
    console.log();
    console.log('[options]:');
    console.log('    --version, -v           Displays version information');
    console.log('    --help                  Prints this help message');
    console.log();
    return;
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
    return;
} else if (command === 'update' && argv.help) {
    console.log();
    console.log('usage deploy update <STACK>');
    console.log()
    return;
} else if (command === 'delete' && argv.help) {
    console.log();
    console.log('usage deploy delete <STACK>');
    console.log()
    return;
} else if (command === 'list' && argv.help) {
    console.log();
    console.log('usage deploy list');
    console.log();
    console.error('List all of the currently running stacks deployed from the current repo');
    console.log()
    return;
} else if (command === 'env' && argv.help) {
    console.log();
    console.log('usage deploy env');
    console.log();
    console.error('Export AWS_ environment variables into current shell');
    console.log()
    return;
} else if (mode[command] && argv.help) {
    mode[command].help();
} else if (argv.help) {
    console.error('Subcommand not found!');
    process.exit(1);
}

const repo = path.parse(path.resolve('.')).name;

const git = cp.spawnSync('git', [
    '--git-dir', path.resolve('.', '.git'),
    'rev-parse', 'HEAD'
]);

if (!git.stdout) throw new Error('Is this a git repo? Could not determine GitSha');
const sha = String(git.stdout).replace(/\n/g, '');

let dotdeploy;

try {
    dotdeploy = JSON.parse(fs.readFileSync('.deploy'));
} catch (err) {
    if (err.name === 'SyntaxError') {
        throw new Error('Invalid JSON in .deploy file');
    }

    dotdeploy = {};
}

if (command === 'init') {
    prompt.message = '$';
    prompt.start();

    prompt.get([{
        name: 'profile',
        type: 'string',
        required: true,
        default: 'default'
    },{
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

        fs.readFile(path.resolve(process.env.HOME, '.deployrc.json'), (err, creds) => {

            if (err) {
                creds = {};
            } else {
                creds = JSON.parse(creds);
            }

            creds[argv.profile] = {
                region: argv.region,
                accountId: argv.accountId,
                accessKeyId: argv.accessKeyId,
                secretAccessKey: argv.secretAccessKey
            };

            fs.writeFileSync(path.resolve(process.env.HOME, '.deployrc.json'), JSON.stringify(creds, null, 4));
        });
    });
} else if (command === 'env') {
    loadCreds(argv, (err, creds) => {
        if (err) throw err;

        console.log(`export AWS_DEFAULT_REGION=${creds.region}`);
        console.log(`export AWS_ACCESS_KEY_ID=${creds.accessKeyId}`);
        console.log(`export AWS_SECRET_ACCESS_KEY=${creds.secretAccessKey}`);

        console.error(`ok - [${creds.profile}] environment configured`);
    });
} else if (['create', 'update', 'delete'].indexOf(command) > -1) {
    if (!argv._[3]) return console.error(`Stack name required: run deploy ${command} --help`);
    const stack = argv._[3];

    loadCreds(argv, (err, creds) => {
        if (err) throw err;

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

            template = tagger(template, dotdeploy.tags);

            fs.writeFileSync(cf_path, JSON.stringify(template, null, 4));

            if (command === 'create') {
                artifacts(creds, (err) => {
                    if (err) return console.error(`Artifacts Check Failed: ${err.message}`);

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
                artifacts(creds, (err) => {
                    if (err) return console.error(`Artifacts Check Failed: ${err.message}`);

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
    })
} else if (command === 'list') {
    loadCreds(argv, (err, creds) => {
        if (err) throw err;

        const cloudformation = new AWS.CloudFormation({
            region: creds.region
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
    });
} else if (mode[command]) {
    loadCreds(argv, (err, creds) => {
        if (err) throw err;

        mode[command].main(creds, process.argv);
    });
} else {
    console.error('Subcommand not found!');
    process.exit(1);
}

/**
 * Add additional global tags
 */
function tagger(template, tags) {
    if (!template.Resources) return template;
    if (!tags || !tags.length) return template;

    for (const name of Object.keys(template.Resources)) {
        if (
            !template.Resources[name].Type
            || !schema.ResourceTypes[template.Resources[name].Type]
            || !schema.ResourceTypes[template.Resources[name].Type].Properties
            || !schema.ResourceTypes[template.Resources[name].Type].Properties.Tags
        ) continue;

        if (!template.Resources[name].Properties) {
            template.Resources[name].Properties = {};
        };

        if (!template.Resources[name].Properties.Tags) {
            template.Resources[name].Properties.Tags = [];
        }

        const tag_names = template.Resources[name].Properties.Tags.map((t) => t.Key);

        for (const oTag of tags) {
            if (tag_names.includes(oTag)) {
                for (const tag of template.Resources[name].Properties.Tags) {
                    if (tag.Key === oTag.Key) {
                        tag.Value = oTag.Value;
                        break;
                    }
                }
            } else {
                template.Resources[name].Properties.Tags.push(oTag);
            }
        }
    }

    return template;
}

function loadCreds(argv, cb) {
    fs.readFile(path.resolve(process.env.HOME, '.deployrc.json'), (err, creds) => {
        if (err) return cb(new Error('No creds found - run "deploy init"'));

        creds = JSON.parse(creds);

        if (argv.profile) {
            if (!creds[argv.profile]) return cb(new Error(`${argv.profile} profile not found in creds`));
            creds = creds[argv.profile];
            creds.profile = argv.profile;
        } else if (dotdeploy.profile) {
            if (!creds[dotdeploy.profile]) return cb(new Error(`${argv.profile} profile not found in creds`));
            creds = creds[dotdeploy.profile];
            creds.profile = dotdeploy.profile;
        } else if (Object.keys(creds).length > 1) {
            return cb(new Error('Multiple deploy profiles found. Deploy with --profile or set a .deploy file'));
        } else {
            creds = Object.keys(creds)[0];
            creds.profile = 'default';
        }

        try {
            AWS.config.credentials = new AWS.Credentials(creds);
        } catch (err) {
            return cb(new Error('creds not set: run deploy init'));
        }

        cf.preauth(creds);

        creds.repo = repo;
        creds.sha = sha;
        creds.dotdeploy = dotdeploy;

        return cb(null, creds);
    });
}
