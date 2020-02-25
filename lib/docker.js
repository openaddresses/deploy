const AWS = require('aws-sdk');
const cp = require('child_process');

function checkImage(creds, template, cb) {
    let retries = 0;
    const maxRetries = 60;

    if (!template.Parameters.GitSha) return cb();

    const git = cp.spawnSync('git', [
        '--git-dir', path.resolve('.', '.git'),
        'rev-parse', 'HEAD'
    ]);

    if (!git.stdout) return cb(new Error('Is this a git repo? Could not determine GitSha'));
    const sha = String(git.stdout).replace(/\n/g, '');

    check();

    function check() {
        const ecr = new AWS.ECR({ region: creds.region });

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
                setTimeout(check, 5000);
            } else {
                return cb(new Error('No image found for commit ' + sha ));
            }
        });
    }
}

module.exports = {
    checkImage
}
