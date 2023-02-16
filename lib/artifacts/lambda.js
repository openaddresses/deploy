import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
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
        return;
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
        const s3 = new S3Client({
            credentials: creds.aws,
            region: creds.region
        });

        lambda = Handlebars.compile(lambda)({
            project: creds.repo ,
            gitsha: creds.sha
        });

        retries[lambda] = 0;

        checks3();

        async function checks3() {
            try {
                const data = await s3.send(new HeadObjectCommand({
                    Bucket: lambda.split('/')[0],
                    Key: lambda.split('/').splice(1).join('/')
                }));

                if (data && data.ContentLength) {
                    console.log(`Found Lambda: ${lambda}`)
                    return resolve(lambda);
                } else {
                    return reject(new Error(`No lambda found for: ${lambda}`));
                }
            } catch (err) {
                if (err && err.code === 'NotFound' && retries[lambda] < MAX_RETRIES) {
                    if (retries[lambda] === 0) console.log(`Waiting for Lambda: ${lambda}`);
                    retries[lambda] += 1;
                    setTimeout(checks3, 5000);
                } else {
                    return reject(err);
                }
            }
        }
    });
}
