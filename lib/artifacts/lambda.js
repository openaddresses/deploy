import AWS from 'aws-sdk';
import path from 'path';
import fs from 'fs';
import Handlebars from 'handlebars';

const retries = {};
const MAX_RETRIES = 60;

/**
 * Ensure lambda artifacts are present before deploy
 *
 * @param {Credentials} creds Credentials
 */
export default async function check(creds) {
    let lambdas = [];

    // docker check explicitly disabled
    if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.lambda === false
    ) {
        return resolve();
    } else if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.lambda
    ) {
        if (typeof creds.dotdeploy.artifacts.lambda === 'string') {
            lambdas.push(creds.dotdeploy.artifacts.lambda)
        } else {
            creds.dotdeploy.artifacts.lambda.forEach((l) => {
                lambdas.push(l);
            });
        }
    }

    for (const lambda of lambdas) {
        await single(creds, lambda);
    }

    return true;
}

function single(creds, lambda, cb) {
    return new Promise((resolve, reject) => {
        const s3 = new AWS.S3({
            region: creds.region
        });

        lambda = Handlebars.compile(lambda)({
            project: creds.repo ,
            gitsha: creds.sha
        });

        retries[lambda] = 0;

        checks3();

        function checks3() {
            s3.headObject({
                Bucket: lambda.split('/')[0],
                Key: lambda.split('/').splice(1).join('/')
            }, (err, data) => {
                if (err && err.code === 'NotFound' && retries[lambda] < MAX_RETRIES) {
                    if (retries[lambda] === 0) console.log(`Waiting for Lambda: ${lambda}`);
                    retries[lambda] += 1;
                    setTimeout(checks3, 5000);
                } else if (err && err.code !== 'NotFound') {
                    return reject(err);
                } else if (data && data.ContentLength) {
                    console.log(`Found Lambda: ${lambda}`)
                    return resolve(lambda);
                } else {
                    return reject(new Error(`No lambda found for: ${lambda}`));
                }
            });
        }
    });
}
