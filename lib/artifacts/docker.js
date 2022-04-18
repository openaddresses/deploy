import AWS from 'aws-sdk';
import path from 'path';
import fs from 'fs';
import Handlebars from 'handlebars';

const retries = {};
const MAX_RETRIES = 60;

/**
 * Ensure docker artifacts are present before deploy
 *
 * @param {Credentials} creds Credentials
 */
export default async function check(creds) {
    let images = [];

    // docker check explicitly disabled
    if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.docker === false
    ) {
        return resolve();
    } else if (
        !creds.dotdeploy.artifacts
        || !creds.dotdeploy.artifacts.docker
    ) {
        // No dotdeploy or docker file found
        try {
            fs.accessSync('./Dockerfile');
        } catch(err) {
            return resolve();
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

    await single(creds, image, done);

    return true;
}

function single(creds, image) {
    return new Promise((resolve, reject) => {
        const ecr = new AWS.ECR({
            region: creds.region
        });

        image = Handlebars.compile(image)({
            project: creds.repo ,
            gitsha: creds.sha
        });

        retries[image] = 0;

        if (image.split(':').length !== 2) {
            return reject(new Error('docker artifact must be in format <ECR>:<TAG>'));
        }

        checkecr();

        function checkecr() {
            ecr.batchGetImage({
                imageIds: [{ imageTag: image.split(':')[1] }],
                repositoryName: image.split(':')[0]
            }, (err, data) => {
                if (err) return reject(err);

                if (data && data.images.length) {
                    console.log(`Found Docker Image: AWS::ECR:${image}`)
                    return resolve(image);
                } else if (retries[image] < MAX_RETRIES) {
                    if (retries[image] === 0) console.log(`Waiting for Docker Image: AWS::ECR: ${image}`);
                    retries[image] += 1;
                    setTimeout(checkecr, 5000);
                } else {
                    return reject(new Error(`No image found for: ${image}`));
                }
            });
        }
    });
}
