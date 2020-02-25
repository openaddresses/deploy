const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const Q = require('d3-queue').queue;
const Handlebars = require('handlebars');

function checkImage(creds, cb) {
    let retries = 0;
    const maxRetries = 60;

    let images = [];

    // docker check explicitly disabled
    if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.docker === false
    ) {
        return cb();
    } else if (
        !creds.dotdeploy.artifacts
        || !creds.dotdeploy.artifacts.docker
    ) {
        // No dotdeploy or docker file found
        try {
            fs.accessSync(path.resolve(__dirname, 'Dockerfile'));
        } catch(err) {
            return cb();
        }

        images.push(`{{project}}:{{gitsha}}`);
    } else if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.docker
    ) {
        if (typeof creds.dotdeploy.artifacts.docker === 'string') {
            images.push(creds.dotdeploy.artifacts.docker)
        } else {
            creds.dotdeploy.artifacts.docker.forEach((image) => {
                images.push(image);
            });
        }
    }

    const q = new Q();

    for (const image of images) {
        q.defer((creds, image, done) => {
            check(creds, image, done);
        }, creds, image);
    }

    q.awaitAll((err) => {
        if (err) return cb(err);

        return cb();
    });
}

function check(creds, image, cb) {
    const ecr = new AWS.ECR({
        region: creds.region
    });

    image = Handlebars.compile(image)({
        project: creds.repo ,
        gitsha: creds.sha
    });

    if (image.split(':').length !== 2) {
        return cb(new Error('docker artifact must be in format <ECR>:<TAG>'));
    }

    ecr.batchGetImage({
        imageIds: [{ imageTag: image.split(':')[1] }],
        repositoryName: image.split(':')[0]
    }, (err, data) => {
        if (err) return cb(err);

        if (data && data.images.length) {
            return cb(null, image);
        } else if (retries < maxRetries) {
            if (retries === 0) console.log(`Waiting for Docker Image: AWS::ECR: ${image}`);
            retries += 1;
            setTimeout(check, 5000);
        } else {
            return cb(new Error(`No image found for: ${image}`));
        }
    });
}

module.exports = {
    checkImage
}
