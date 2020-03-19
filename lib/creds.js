const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');
const cp = require('child_process');

class Credentials {
    static load(argv, cb) {
        const repo = path.parse(path.resolve('.')).name;

        const git = cp.spawnSync('git', [
            '--git-dir', path.resolve('.', '.git'),
            'rev-parse', 'HEAD'
        ]);

        if (!git.stdout) return(new Error('Is this a git repo? Could not determine GitSha'));
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

        fs.readFile(path.resolve(process.env.HOME, '.deployrc.json'), (err, creds) => {
            if (err) return cb(new Error('No creds found - run "deploy init"'));

            creds = JSON.parse(creds);

            if (argv.template) {
                creds.subname = '-' + path.parse(argv.template).name.replace(/\.template/, '');
                creds.template = argv.template;
            } else {
                creds.subname = '';

                let cf_base = `${creds.repo}.template`
                let cf_path = false;
                for (let file of fs.readdirSync(path.resolve('./cloudformation/'))) {
                    if (file.indexOf(cf_base) === -1) continue;

                    const ext = path.parse(file).ext;
                    if (ext === '.js' || ext === '.json') {
                        cf_path = path.resolve('./cloudformation/', file);
                        break;
                    }
                }

                if (!cf_path) {
                    return cb(new Error(`Could not find CF Template in cloudformation/${creds.repo}.template.js(on)`));
                }

                creds.template = cf_path;
            }

            if (argv.profile) {
                if (!creds[argv.profile]) return cb(new Error(`${argv.profile} profile not found in creds`));
                creds = Object.assign(creds, creds[argv.profile]);
                creds.profile = argv.profile;
            } else if (dotdeploy.profile) {
                if (!creds[dotdeploy.profile]) return cb(new Error(`${argv.profile} profile not found in creds`));
                creds = Object.assign(creds, creds[dotdeploy.profile]);
                creds.profile = dotdeploy.profile;
            } else if (Object.keys(creds).length > 1) {
                return cb(new Error('Multiple deploy profiles found. Deploy with --profile or set a .deploy file'));
            } else {
                creds = Object.assign(creds, Object.keys(creds)[0]);
                creds.profile = 'default';
            }

            try {
                AWS.config.credentials = new AWS.Credentials(creds);
            } catch (err) {
                return cb(new Error('creds not set: run deploy init'));
            }

            creds.repo = repo;
            creds.sha = sha;
            creds.dotdeploy = dotdeploy;

            return cb(null, creds);
        });

    }
}

module.exports = Credentials;
