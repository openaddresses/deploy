import fs from 'node:fs';
import Handlebars from 'handlebars';
import ora from 'ora';
import { BatchGetImageCommand, ECRClient } from '@aws-sdk/client-ecr';
import type { DeployContext } from '../types.js';

const retries = new Map<string, number>();
const MAX_RETRIES = 60;

export default async function check(creds: DeployContext): Promise<true | void> {
    const images: string[] = [];
    const dockerArtifacts = creds.dotdeploy.artifacts?.docker;

    if (dockerArtifacts === false) {
        return;
    }

    if (!dockerArtifacts) {
        try {
            fs.accessSync('./Dockerfile');
        } catch {
            return;
        }

        images.push('{{project}}:{{gitsha}}');
    } else if (typeof dockerArtifacts === 'string') {
        images.push(dockerArtifacts);
    } else {
        images.push(...dockerArtifacts);
    }

    for (const image of images) {
        await single(creds, image);
    }

    return true;
}

async function single(creds: DeployContext, imageTemplate: string): Promise<string> {
    const ecr = new ECRClient({
        credentials: creds.aws,
        region: creds.region
    });

    const image = Handlebars.compile(imageTemplate)({
        rootStackName: `${creds.repo}-${creds.stack}`,
        fullStackName: `${creds.repo}-${creds.name}`,
        accountId: creds._accountId ?? await creds.accountId(),
        stack: creds.stack,
        region: creds.region,
        project: creds.repo,
        gitsha: creds.sha
    }) as string;

    const progress = ora(`Docker Image: AWS::ECR:${image}`).start();
    retries.set(image, 0);

    if (image.split(':').length !== 2) {
        progress.fail();
        throw new Error('docker artifact must be in format <ECR>:<TAG>');
    }

    return await new Promise<string>((resolve, reject) => {
        const checkEcr = async (): Promise<void> => {
            try {
                const [repositoryName, imageTag] = image.split(':');
                const data = await ecr.send(new BatchGetImageCommand({
                    imageIds: [{ imageTag }],
                    repositoryName
                }));

                if ((data.images?.length ?? 0) > 0) {
                    progress.succeed();
                    resolve(image);
                    return;
                }

                const attempt = retries.get(image) ?? 0;
                if (attempt < MAX_RETRIES) {
                    retries.set(image, attempt + 1);
                    setTimeout(() => {
                        void checkEcr();
                    }, 5000);
                    return;
                }

                progress.fail();
                reject(new Error(`No image found for: ${image}`));
            } catch (error) {
                progress.fail();
                reject(error);
            }
        };

        void checkEcr();
    });
}
