import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import Handlebars from 'handlebars';
import ora from 'ora';

const retries = {};
const MAX_RETRIES = 60;

/**
 * Ensure lambda artifacts are present before deploy
 *
 * @param {Credentials} creds Credentials
 */
export default async function check(creds) {
    const objects = [];

    if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.s3 === false
    ) {
        return;
    } else if (
        creds.dotdeploy.artifacts
        && creds.dotdeploy.artifacts.s3
    ) {
        if (typeof creds.dotdeploy.artifacts.s3 === 'string') {
            objects.push(creds.dotdeploy.artifacts.s3);
        } else {
            creds.dotdeploy.artifacts.s3.forEach((l) => {
                objects.push(l);
            });
        }
    }

    for (const object of objects) {
        await single(creds, object);
    }

    return true;
}

function single(creds, object) {
    return new Promise((resolve, reject) => {
        const s3 = new S3Client({
            credentials: creds.aws,
            region: creds.region
        });

        object = Handlebars.compile(object)({
            rootStackName: `${creds.repo}-${creds.stack}`,
            fullStackName: `${creds.repo}-${creds.name}`,
            accountId: creds._accountId,
            stack: creds.stack,
            region: creds.region,
            project: creds.repo,
            gitsha: creds.sha
        });

        const progress = ora(`S3 Object: AWS::S3:${object}`).start();

        retries[object] = 0;

        checks3();

        async function checks3() {
            try {
                const data = await s3.send(new HeadObjectCommand({
                    Bucket: object.split('/')[0],
                    Key: object.split('/').splice(1).join('/')
                }));

                if (data && data.ContentLength) {
                    progress.succeed();
                    return resolve(object);
                } else {
                    progress.fail();
                    return reject(new Error(`No object found for: ${object}`));
                }
            } catch (err) {
                if (err && String(err).includes('NotFound') && retries[object] < MAX_RETRIES) {
                    retries[object] += 1;
                    setTimeout(checks3, 5000);
                } else {
                    return reject(err);
                }
            }
        }
    });
}
