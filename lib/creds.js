import fs from 'fs';
import path from 'path';
import AWS from 'aws-sdk';
import Git from './git.js';
import AJV from 'ajv';

const ajv = new AJV({
    allErrors: true
});

// Only these keys are allowed to overwrite Credentials keys
// when loaded from a .deployrc.json file
const PROFILE_KEYS = [
    'region',
    'accessKeyId',
    'secretAccessKey',
    'github'
];

/**
 * Store all credentials required for deploy functionality
 *
 * @class
 *
 * @param {Object} argv Command Line Arguments
 * @param {Object} opts Options Object
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
 * @prop {string} accessKeyId
 * @prop {string} secretAccessKey
 */
export default class Credentials {
    constructor (argv, opts) {
        this.user = Git.user();
        this.owner = Git.owner();

        this.repo = Git.repo();
        this.sha = Git.sha();

        // If GH deployment has been requested, store ID here
        this.deployment = false;

        this.name = false;
        this.stack = (argv._[3] || '').replace(new RegExp(`^${this.repo}-`), '');
        this.subname = false;
        this.template = false;
        this.profile = false;
        this.dotdeploy = {};
        this.profiles = {};
        this.tags = [];

        this.region = 'us-east-1';
        this.accessKeyId = false;
        this.secretAccessKey = false;

        this.github = false;

        if (opts.template === undefined) opts.template = true;

        this.dotdeploy = Credentials.dot_deploy();

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
                this.profiles[key] = readcreds[key];
            }
        });

        // CLI Params override config
        if (argv.region) {
            this.region = argv.region;
        } else if (this.dotdeploy.region) {
            this.region = this.dotdeploy.region;
        }

        if (opts.template && argv.template) {
            this.subname = path.parse(argv.template).name.replace(/\.template/, '') + '-';
            this.template = argv.template;
        } else if (opts.template) {
            this.subname = '';

            const cf_base = `${this.repo}.template`;
            let cf_path = false;
            for (const file of fs.readdirSync(path.resolve('./cloudformation/'))) {
                if (file.indexOf(cf_base) === -1) continue;

                if (
                    path.parse(file).name === this.repo + '.template'
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
                throw new Error(`Could not find CF Template in cloudformation/${this.repo}.template.js(on)`);
            }

            this.template = cf_path;
        }

        if (this.dotdeploy.name) {
            this.repo = this.dotdeploy.name;
        }

        if (argv.profile) {
            this.profile = argv.profile;
        } else if (this.dotdeploy.profile) {
            this.profile = this.dotdeploy.profile;
        } else if (Object.keys(this.profiles).length > 1) {
            throw new Error('Multiple deploy profiles found. Deploy with --profile or set a .deploy file');
        } else {
            this.profile = Object.keys(this.profiles)[0];
        }

        if (!this.profiles[this.profile]) this.profiles[this.profile] = {};

        PROFILE_KEYS.forEach((key) => {
            if (this.profiles[this.profile][key] !== undefined) {
                this[key] = this.profiles[this.profile][key];
            }
        });

        if (argv.name) {
            this.name = argv.name.replace(new RegExp(`^${this.repo}-`, ''));
        } else {
            this.name = (this.subname || '') + this.stack;
        }

        if (!readcreds[this.profile]) {
            readcreds[this.profile] = {};
        }

        if (readcreds[this.profile].tags) {
            this.tags = this.tags.concat(readcreds[this.profile].tags);
        }

        if (this.dotdeploy.tags) {
            this.tags = this.tags.concat(this.dotdeploy.tags || []);
        }

        try {
            if (!this.accessKeyId || !this.secretAccessKey) {
                // If there is no accesskey/secret access key, see if we can obtain them from the aws credentials
                const awscreds = new AWS.SharedIniFileCredentials({
                    profile: this.profile
                });

                this.accessKeyId = awscreds.accessKeyId;
                this.secretAccessKey = awscreds.secretAccessKey;
                this.sessionToken = awscreds.sessionToken;
            }

            AWS.config.credentials = new AWS.Credentials({
                region: this.region,
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey,
                sessionToken: this.sessionToken,
            });
        } catch (err) {
            throw new Error('creds not set: run deploy init');
        }
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

        const STS = new AWS.STS({ region: this.region });

        const account = await STS.getCallerIdentity().promise();
        this._accountId = account.Account;

        return this._accountId;
    }
}
