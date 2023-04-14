import fs from 'fs/promises';
import path from 'path';
import prompt from 'prompt';
import { fromIni } from '@aws-sdk/credential-providers';
import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';

prompt.message = '$';

/**
 * @class
 */
export default class Init {
    static short = 'Setup Credentials for a new AWS Account';

    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Setup the deploy tool with AWS credentials');
        console.log();
        console.log('Usage: deploy init');
        console.log();
    }

    /**
     * Initialize a new AWS profile/credentials
     */
    static async main() {
        prompt.start();

        const argv = await prompt.get([{
            name: 'profile-name',
            type: 'string',
            required: true,
            default: 'default'
        },{
            name: 'region',
            type: 'string',
            required: true,
            default: 'us-east-1'
        }]);


        const awscreds = await (await fromIni({
            profile: argv['profile-name']
        })());


        // If credentials don't exist in aws credentials, request them
        if (!awscreds.accessKeyId) {
            throw new Error(`No profile for ${argv['profile-name']} found in ~/.aws/credentials`);
        }

        let creds;
        try {
            creds = await fs.readFile(path.resolve(process.env.HOME, '.deployrc.json'));
            creds = JSON.parse(creds);
        } catch (err) {
            creds = {};
        }

        creds[argv['profile-name']] = {
            region: argv.region,
            accessKeyId: argv.accessKeyId,
            secretAccessKey: argv.secretAccessKey
        };

        await fs.writeFile(path.resolve(process.env.HOME, '.deployrc.json'), JSON.stringify(creds, null, 4));
    }

    /**
     * Ensure Template & Config S3 Buckets are present in the account
     *
     * @param {Context} context
     */
    static async bucket(context) {
        const s3 = new S3Client({
            credentials: context.aws,
            region: context.region
        });

        for (const Bucket of ['cfn-config-templates-', 'cfn-config-active-']) {
            if (!context.region) continue;

            const full = Bucket + await context.accountId() + '-' + context.region;
            try {
                await s3.send(new HeadBucketCommand({
                    Bucket: full,
                    ExpectedBucketOwner: await context.accountId()
                }));
            } catch (err) {
                if (err.name === 'NotFound') {
                    prompt.start();

                    console.log(`Config Store s3://${full} not found! Create it?`);
                    const argv = await prompt.get([{
                        name: 'create',
                        type: 'string',
                        required: true,
                        default: 'y/N'
                    }]);

                    if (argv.create.toLowerCase() !== 'y') continue;

                    await s3.send(new CreateBucketCommand({
                        Bucket: full
                    }));
                }
            }
        }
    }
}
