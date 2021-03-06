'use strict';

const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const cp = require('child_process');

// Only these keys are allowed to overwrite Credentials keys
// when loaded from a .deployrc.json file
const PROFILE_KEYS = [
    'region',
    'accountId',
    'accessKeyId',
    'secretAccessKey',
    'github'
];

/**
 * Store all credentials required for deploy functionality
 *
 * @class Credentials
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
 * @prop {string} accountId
 * @prop {string} accessKeyId
 * @prop {string} secretAccessKey
 */
class Credentials {
    constructor (argv, opts) {
        this.user = Credentials.gituser();
        this.owner = Credentials.gitowner();
        this.repo = Credentials.gitrepo();
        this.sha = Credentials.gitsha();

        // If GH deployment has been requested, store ID here
        this.deployment = false;

        this.name = false;
        this.stack = argv._[3];
        this.subname = false;
        this.template = false;
        this.profile = false;
        this.dotdeploy = {};
        this.profiles = {};
        this.tags = [];

        this.region = 'us-east-1';
        this.accountId = false;
        this.accessKeyId = false;
        this.secretAccessKey = false;

        this.github = false;

        if (opts.template === undefined) opts.template = true;

        try {
            this.dotdeploy = JSON.parse(fs.readFileSync('.deploy'));
        } catch (err) {
            if (err.name === 'SyntaxError') {
                throw new Error('Invalid JSON in .deploy file');
            }
        }

        let readcreds;
        try {
            readcreds = JSON.parse(fs.readFileSync(path.resolve(process.env.HOME, '.deployrc.json')));
        } catch (err) {
            throw new Error('No creds found - run "deploy init"');
        }

        Object.keys(readcreds).forEach((key) => {
            if (readcreds[key] !== undefined) {
                this.profiles[key] = readcreds[key];
            }
        });

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
            if (!this.profiles[argv.profile]) throw new Error(`${argv.profile} profile not found in creds`);
            this.profile = argv.profile;
        } else if (this.dotdeploy.profile) {
            if (!this.profiles[this.dotdeploy.profile]) throw new Error(`${argv.profile} profile not found in creds`);
            this.profile = this.dotdeploy.profile;
        } else if (Object.keys(this.profiles).length > 1) {
            throw new Error('Multiple deploy profiles found. Deploy with --profile or set a .deploy file');
        } else {
            this.profile = Object.keys(this.profiles)[0];
        }

        PROFILE_KEYS.forEach((key) => {
            if (this.profiles[this.profile][key] !== undefined) {
                this[key] = this.profiles[this.profile][key];
            }
        });

        if (argv.name) {
            this.name = argv.name;
        } else {
            this.name = this.subname + this.stack;
        }

        if (readcreds[this.profile].tags) this.tags = readcreds[this.profile].tags;

        try {
            if (!this.accessKeyId || !this.secretAccessKey) {
                // If there is no accesskey/secret access key, see if we can obtain them from the aws credentials
                const awscreds = new AWS.SharedIniFileCredentials({
                    profile: this.profile
                });

                this.accessKeyId = awscreds.accessKeyId;
                this.secretAccessKey = awscreds.secretAccessKey;
            }

            AWS.config.credentials = new AWS.Credentials({
                region: this.region,
                accountId: this.accountId,
                accessKeyId: this.accessKeyId,
                secretAccessKey: this.secretAccessKey
            });
        } catch (err) {
            throw new Error('creds not set: run deploy init');
        }
    }

    /**
     * Get the name of the current GitRepo
     * @return {string}
     */
    static gitrepo() {
        return path.parse(path.resolve('.')).name;
    }

    /**
     * Get the name of the current git user
     * @return {string}
     */
    static gituser() {
        const git = cp.spawnSync('git', [
            'config', 'user.name'
        ]);

        if (!git.stdout) return (new Error('Is this a git repo? Could not determine GitSha'));
        return String(git.stdout).replace(/\n/g, '');
    }

    /**
     * Get the name of the upstream git owner
     * @return {string}
     */
    static gitowner() {
        const git = cp.spawnSync('git', [
            'config', '--get', 'remote.origin.url'
        ]);

        if (!git.stdout) return (new Error('Is this a git repo? Could not determine upstream url'));

        const owner = String(git.stdout).replace(/\n/g, '');

        if (!owner.includes('git@github.com')) throw new Error('only origins of format: git@github.com are supported');

        return owner
            .replace(/.*git@github.com:/, '')
            .replace(/\/.*/, '');
    }

    /**
     * Get the current GitSha
     */
    static gitsha() {
        const git = cp.spawnSync('git', [
            '--git-dir', path.resolve('.', '.git'),
            'rev-parse', 'HEAD'
        ]);

        if (!git.stdout) return (new Error('Is this a git repo? Could not determine GitSha'));
        return String(git.stdout).replace(/\n/g, '');

    }
}

module.exports = Credentials;
