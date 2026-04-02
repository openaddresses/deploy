import Handlebars from 'handlebars';
import ora from 'ora';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { DeployContext } from '../types.js';

const retries = new Map<string, number>();
const MAX_RETRIES = 60;

export default async function check(creds: DeployContext): Promise<true | void> {
    const objects: string[] = [];
    const s3Artifacts = creds.dotdeploy.artifacts?.s3;

    if (s3Artifacts === false || !s3Artifacts) {
        return;
    }

    if (typeof s3Artifacts === 'string') {
        objects.push(s3Artifacts);
    } else {
        objects.push(...s3Artifacts);
    }

    for (const object of objects) {
        await single(creds, object);
    }

    return true;
}

async function single(creds: DeployContext, objectTemplate: string): Promise<string> {
    const s3 = new S3Client({
        credentials: creds.aws,
        region: creds.region
    });

    const object = Handlebars.compile(objectTemplate)({
        rootStackName: `${creds.repo}-${creds.stack}`,
        fullStackName: `${creds.repo}-${creds.name}`,
        accountId: creds._accountId ?? await creds.accountId(),
        stack: creds.stack,
        region: creds.region,
        project: creds.repo,
        gitsha: creds.sha
    }) as string;

    const progress = ora(`S3 Object: AWS::S3:${object}`).start();
    retries.set(object, 0);

    return await new Promise<string>((resolve, reject) => {
        const checkS3 = async (): Promise<void> => {
            try {
                const [bucket, ...keyParts] = object.split('/');
                const data = await s3.send(new HeadObjectCommand({
                    Bucket: bucket,
                    Key: keyParts.join('/')
                }));

                if ((data.ContentLength ?? 0) > 0) {
                    progress.succeed();
                    resolve(object);
                    return;
                }

                progress.fail();
                reject(new Error(`No object found for: ${object}`));
            } catch (error) {
                const attempt = retries.get(object) ?? 0;
                if (String(error).includes('NotFound') && attempt < MAX_RETRIES) {
                    retries.set(object, attempt + 1);
                    setTimeout(() => {
                        void checkS3();
                    }, 5000);
                    return;
                }

                progress.fail();
                reject(error);
            }
        };

        void checkS3();
    });
}
