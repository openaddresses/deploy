import { ECRClient, BatchGetImageCommand } from '@aws-sdk/client-ecr';
import fs from 'fs';
import ora from 'ora';
import Handlebars from 'handlebars';

const retries = {};
const MAX_RETRIES = 60;

/**
 * Ensure docker artifacts are present before deploy
 *
 * @param {Credentials} creds Credentials
 */
export default async function check(creds) {
    const images = [];

    // docker check explicitly disabled
    if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.docker === false
    ) {
        return;
    } else if (
        !creds.dotdeploy.artifacts
        || !creds.dotdeploy.artifacts.docker
    ) {
        // No dotdeploy or docker file found
        try {
            fs.accessSync('./Dockerfile');
        } catch (err) {
            return;
        }

        images.push('{{project}}:{{gitsha}}');
    } else if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.docker
    ) {
        if (typeof creds.dotdeploy.artifacts.docker === 'string') {
            images.push(creds.dotdeploy.artifacts.docker);
        } else {
            creds.dotdeploy.artifacts.docker.forEach((image) => {
                images.push(image);
            });
        }
    }

    for (const image of images) {
        await single(creds, image);
    }

    return true;
}

function single(creds, image) {
    return new Promise((resolve, reject) => {
        const ecr = new ECRClient({
            credentials: creds.aws,
            region: creds.region
        });

        image = Handlebars.compile(image)({
            project: creds.repo ,
            gitsha: creds.sha
        });

        const progress = ora(`Docker Image: AWS::ECR:${image}`).start();

        retries[image] = 0;

        if (image.split(':').length !== 2) {
            return reject(new Error('docker artifact must be in format <ECR>:<TAG>'));
        }

        checkecr();

        async function checkecr() {
            try {
                const data = await ecr.send(new BatchGetImageCommand({
                    imageIds: [{ imageTag: image.split(':')[1] }],
                    repositoryName: image.split(':')[0]
                }));

                if (data && data.images.length) {
                    progress.succeed();
                    return resolve(image);
                } else if (retries[image] < MAX_RETRIES) {
                    retries[image] += 1;
                    setTimeout(checkecr, 5000);
                } else {
                    progress.fail();
                    return reject(new Error(`No image found for: ${image}`));
                }
            } catch (err) {
                return reject(err);
            }
        }
    });
}
