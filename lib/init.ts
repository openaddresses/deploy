import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import prompt from 'prompt';
import type { BucketLocationConstraint } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import type { DeployContext, DeployProfile } from './types.js';
import { asError, errorCode, isRecord, parseJson } from './util.js';

function promptValue(answers: Record<string, unknown>, key: string): string {
    const value = answers[key];
    return typeof value === 'string' ? value : '';
}

function isProfiles(value: unknown): value is Record<string, DeployProfile> {
    return isRecord(value) && Object.values(value).every((profile) => isRecord(profile));
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
        }]);
        const profileName = promptValue(answers, 'profile-name');
        const region = promptValue(answers, 'region');

        const awscreds = await fromIni({
            profile: profileName
        })();

        if (!awscreds.accessKeyId) {
            throw new Error(`No profile for ${profileName} found in ~/.aws/credentials`);
        }

        const deployRcPath = path.resolve(os.homedir(), '.deployrc.json');
        let creds: Record<string, DeployProfile> = {};

        try {
            const content = await fs.readFile(deployRcPath, 'utf8');
            const parsed = parseJson(content);
            if (isProfiles(parsed)) {
                creds = parsed;
            }
        } catch (error) {
            if (errorCode(error) !== 'ENOENT') {
                console.log(`Could not read .deployrc.json (${asError(error).message})`);
            }
        }

        creds[profileName] = {
            ...creds[profileName],
            region
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
                const name = error instanceof Error ? error.name : undefined;
                if (name !== 'NotFound' && name !== 'NoSuchBucket') {
                    throw error;
                }

                prompt.start();
                console.log(`Config Store s3://${fullName} not found! Create it?`);
                const answer = await prompt.get([{
                    name: 'create',
                    type: 'string',
                    required: true,
                    default: 'y/N'
                }]);

                if (promptValue(answer, 'create').toLowerCase() !== 'y') {
                    continue;
                }

                await s3.send(new CreateBucketCommand({
                    Bucket: fullName,
                    ...(context.region === 'us-east-1' ? {} : {
                        CreateBucketConfiguration: {
                            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the SDK enum lags new regions
                            LocationConstraint: context.region as BucketLocationConstraint
                        }
                    })
                }));
            }
        }
    }
}
