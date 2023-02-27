import fs from 'fs';
import path from 'path';
import Git from './git.js';
import AJV from 'ajv';
import CFN from '@openaddresses/cfn-config';
import { fromIni } from '@aws-sdk/credential-providers';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const ajv = new AJV({
    allErrors: true
});

// Only these keys are allowed to overwrite Credentials keys
// when loaded from a .deployrc.json file
const PROFILE_KEYS = ['region', 'github'];

/**
 * Store all credentials required for deploy functionality
 *
 * @class
 *
 * @param {Object} argv Command Line Arguments
 *
 * @prop {string} repo Git Repository Name
 * @prop {string} sha Current Git Commit Sha
 * @prop {string} name Git Repository Name Override
 * @prop {string} stack
 * @prop {string} subname
 * @prop {string} github Github API token if provided
 * @prop {string} user Name of the current git user
 * @prop {string} user Name of the github repo owner
 * @prop {string} origin Name of the origin repo
 * @prop {string} template path to cloudformation template
 * @prop {string} profile
 * @prop {Object} dotdeploy
 * @prop {Object} profiles
 * @prop {Array} tags
 * @prop {string} region
 * @prop {object} aws AWS Credentials
 */
export default class Credentials {
    static async generate(argv) {
        const creds = new Credentials();
        creds.user = Git.user();
        creds.owner = Git.owner();

        creds.repo = Git.repo();
        creds.sha = Git.sha();

        // If GH deployment has been requested, store ID here
        creds.deployment = false;

        creds.name = false;
        creds.stack = (argv._[3] || '').replace(new RegExp(`^${this.repo}-`), '');
        creds.subname = false;
        creds.template = false;
        creds.profile = false;
        creds.dotdeploy = {};
        creds.profiles = {};
        creds.tags = [];

        creds.region = 'us-east-1';

        creds.github = false;

        creds.dotdeploy = Credentials.dot_deploy();

        let readcreds;
        try {
            readcreds = JSON.parse(fs.readFileSync(path.resolve(process.env.HOME, '.deployrc.json')));
        } catch (err) {
            readcreds = {};
        }

        const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL('../data/rc_schema.json', import.meta.url))));

        if (!validate(readcreds)) {
            console.error(JSON.stringify(validate.errors, null, 4));
            throw new Error('~/.deployrc.json does not conform to schema');
        }

        Object.keys(readcreds).forEach((key) => {
            if (readcreds[key] !== undefined) {
                creds.profiles[key] = readcreds[key];
            }
        });

        // CLI Params override config
        if (argv.region) {
            creds.region = argv.region;
        } else if (creds.dotdeploy.region) {
            creds.region = creds.dotdeploy.region;
        }

        if (argv.template) {
            creds.subname = path.parse(argv.template).name.replace(/\.template/, '') + '-';
            creds.template = argv.template;
        } else if (argv.template === false) {
            creds.subname = null;
            creds.template = null;
        } else {
            creds.subname = '';

            const cf_base = `${creds.repo}.template`;
            let cf_path = false;
            for (const file of fs.readdirSync(path.resolve('./cloudformation/'))) {
                if (file.indexOf(cf_base) === -1) continue;

                if (
                    path.parse(file).name === creds.repo + '.template'
                    && (
                        path.parse(file).ext === '.js'
                        || path.parse(file).ext === '.json'
                    )
                ) {
                    cf_path = path.resolve('./cloudformation/', file);
                    break;
                }
            }

            if (!cf_path) {
                throw new Error(`Could not find CF Template in cloudformation/${creds.repo}.template.js(on)`);
            }

            creds.template = cf_path;
        }

        if (creds.dotdeploy.name) {
            creds.repo = creds.dotdeploy.name;
        }

        if (argv.profile) {
            creds.profile = argv.profile;
        } else if (creds.dotdeploy.profile) {
            creds.profile = creds.dotdeploy.profile;
        } else if (Object.keys(creds.profiles).length > 1) {
            throw new Error('Multiple deploy profiles found. Deploy with --profile or set a .deploy file');
        } else {
            creds.profile = Object.keys(creds.profiles)[0];
        }

        if (!creds.profiles[creds.profile]) creds.profiles[creds.profile] = {};

        PROFILE_KEYS.forEach((key) => {
            if (creds.profiles[creds.profile][key] !== undefined) {
                creds[key] = creds.profiles[creds.profile][key];
            }
        });

        if (argv.name) {
            creds.name = argv.name.replace(new RegExp(`^${creds.repo}-`, ''));
        } else {
            creds.name = (creds.subname || '') + creds.stack;
        }

        if (!readcreds[creds.profile]) {
            readcreds[creds.profile] = {};
        }

        if (readcreds[creds.profile].tags) {
            creds.tags = creds.tags.concat(readcreds[creds.profile].tags);
        }

        if (creds.dotdeploy.tags) {
            creds.tags = creds.tags.concat(creds.dotdeploy.tags || []);
        }

        creds.aws = {};

        try {
            creds.aws = await (await fromIni({
                profile: creds.profile
            })());
        } catch (err) {
            throw new Error('creds not set: run deploy init');
        }

        creds.cfn = new CFN({
            region: creds.region,
            credentials: creds.aws
        },{
            tags: creds.tags,
            name: creds.repo,
            configBucket: `cfn-config-active-${await creds.accountId()}-${creds.region}`,
            templateBucket: `cfn-config-templates-${await creds.accountId()}-${creds.region}`
        });


        return creds;
    }

    /**
     * Attempt to read a dot deploy file
     *
     * @returns {Object} Dot Deploy Object
     */
    static dot_deploy() {
        const attempts = [
            path.resolve('./.deploy'),
            path.resolve(Git.root(), '.deploy')
        ];

        let dotdeploy = false;


        const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL('../data/schema.json', import.meta.url))));

        for (const attempt of attempts) {
            try {
                dotdeploy = JSON.parse(fs.readFileSync(attempt));

                if (!validate(dotdeploy)) {
                    console.error(JSON.stringify(validate.errors, null, 4));
                    throw new Error(`${attempt} does not conform to schema`);
                }
            } catch (err) {
                if (err.name === 'SyntaxError') {
                    throw new Error(`Invalid JSON in ${attempt} file`);
                }

                continue;
            }
        }

        return dotdeploy;
    }

    async accountId() {
        if (this._accountId) return this._accountId;

        const sts = new STSClient({
            credentials: this.aws,
            region: this.region
        });

        const account = await sts.send(new GetCallerIdentityCommand());
        this._accountId = account.Account;

        return this._accountId;
    }
}
