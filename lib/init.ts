import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import prompt from 'prompt';
import type { BucketLocationConstraint } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { DeployContext, DeployProfile } from './types.js';

interface InitPromptResponse {
    'profile-name': string;
    region: string;
}

interface BucketPromptResponse {
    create: string;
}

prompt.message = '$';

export default class Init {
    static short = 'Setup Credentials for a new AWS Account';

    static help(): void {
        console.log();
        console.log('Setup the deploy tool with AWS credentials');
        console.log();
        console.log('Usage: deploy init');
        console.log();
    }

    static async main(): Promise<void> {
        prompt.start();

        const answers = await prompt.get([{
            name: 'profile-name',
            type: 'string',
            required: true,
            default: 'default'
        }, {
            name: 'region',
            type: 'string',
            required: true,
            default: 'us-east-1'
        }]) as unknown as InitPromptResponse;

        const awscreds = await (await fromIni({
            profile: answers['profile-name']
        })()) as { accessKeyId?: string };

        if (!awscreds.accessKeyId) {
            throw new Error(`No profile for ${answers['profile-name']} found in ~/.aws/credentials`);
        }

        const deployRcPath = path.resolve(os.homedir(), '.deployrc.json');
        let creds: Record<string, DeployProfile> = {};

        try {
            const content = await fs.readFile(deployRcPath, 'utf8');
            creds = JSON.parse(content) as Record<string, DeployProfile>;
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code !== 'ENOENT') {
                console.log(`Could not read .deployrc.json (${err.message})`);
            }
        }

        creds[answers['profile-name']] = {
            ...(creds[answers['profile-name']] ?? {}),
            region: answers.region
        };

        await fs.writeFile(deployRcPath, JSON.stringify(creds, null, 4));
    }

    static async bucket(context: DeployContext): Promise<void> {
        const s3 = new S3Client({
            credentials: context.aws,
            region: context.region
        });

        for (const bucketPrefix of ['cfn-config-templates-', 'cfn-config-active-']) {
            const fullName = `${bucketPrefix}${await context.accountId()}-${context.region}`;
            try {
                await s3.send(new HeadBucketCommand({
                    Bucket: fullName,
                    ExpectedBucketOwner: await context.accountId()
                }));
            } catch (error) {
                const err = error as { name?: string };
                if (err.name !== 'NotFound' && err.name !== 'NoSuchBucket') {
                    throw error;
                }

                prompt.start();
                console.log(`Config Store s3://${fullName} not found! Create it?`);
                const answer = await prompt.get([{
                    name: 'create',
                    type: 'string',
                    required: true,
                    default: 'y/N'
                }]) as unknown as BucketPromptResponse;

                if (answer.create.toLowerCase() !== 'y') {
                    continue;
                }

                await s3.send(new CreateBucketCommand({
                    Bucket: fullName,
                    ...(context.region === 'us-east-1' ? {} : {
                        CreateBucketConfiguration: {
                            LocationConstraint: context.region as BucketLocationConstraint
                        }
                    })
                }));
            }
        }
    }
}
