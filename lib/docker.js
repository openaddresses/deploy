const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
const Q = require('d3-queue').queue;
const Handlebars = require('handlebars');

const retries = {};

function checkImage(creds, cb) {
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
            fs.accessSync('./Dockerfile');
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

    q.awaitAll(cb)
}

function check(creds, image, cb) {
    const ecr = new AWS.ECR({
        region: creds.region
    });

    retries[image] = 0;

    image = Handlebars.compile(image)({
        project: creds.repo ,
        gitsha: creds.sha
    });

    if (image.split(':').length !== 2) {
        return cb(new Error('docker artifact must be in format <ECR>:<TAG>'));
    }

    checkecr();

    function checkecr() {
        ecr.batchGetImage({
            imageIds: [{ imageTag: image.split(':')[1] }],
            repositoryName: image.split(':')[0]
        }, (err, data) => {
            if (err) return cb(err);

            if (data && data.images.length) {
                console.log(`Found Docker Image: AWS::ECR:${image}`)
                return cb(null, image);
            } else if (retries[image] < maxRetries) {
                if (retries[image] === 0) console.log(`Waiting for Docker Image: AWS::ECR: ${image}`);
                retries[image] += 1;
                setTimeout(checkecr, 5000);
            } else {
                return cb(new Error(`No image found for: ${image}`));
            }
        });
    }
}

module.exports = {
    checkImage
}
