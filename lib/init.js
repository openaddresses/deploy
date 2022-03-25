'use strict';

const fs = require('fs');
const path = require('path');
const prompt = require('prompt');
const AWS = require('aws-sdk');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);

prompt.message = '$';

/**
 * @class
 */
class Init {
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
        },{
            name: 'accountId',
            type: 'string',
            required: true
        }]);

        const awscreds = new AWS.SharedIniFileCredentials({
            profile: argv['profile-name']
        });

        // If credentials don't exist in aws credentials, request them
        if (!awscreds.accessKeyId) {
            Object.assign(argv, await prompt.get([{
                name: 'accessKeyId',
                type: 'string',
                required: true
            },{
                name: 'secretAccessKey',
                hidden: true,
                replace: '*',
                required: true,
                type: 'string'
            }]));
        }

        let creds;
        try {
            creds = await readFile(path.resolve(process.env.HOME, '.deployrc.json'));
            creds = JSON.parse(creds);
        } catch (err) {
            creds = {};
        }

        creds[argv['profile-name']] = {
            region: argv.region,
            accountId: argv.accountId,
            accessKeyId: argv.accessKeyId,
            secretAccessKey: argv.secretAccessKey
        };

        fs.writeFileSync(path.resolve(process.env.HOME, '.deployrc.json'), JSON.stringify(creds, null, 4));
    }

    /**
     * Ensure Template & Config S3 Buckets are present in the account
     */
    static async bucket(creds) {
        const s3 = new AWS.S3({ region: creds.region });

        for (const Bucket of ['cfn-config-templates-', 'cfn-config-active-']) {
            if (!creds.accountId || !creds.region) continue;

            const full = Bucket + creds.accountId + '-' + creds.region;
            try {
                await s3.headBucket({
                    Bucket: full,
                    ExpectedBucketOwner: creds.accountId
                }).promise();
            } catch (err) {
                if (err.code === 'NotFound') {
                    prompt.start();

                    console.log(`Config Store s3://${full} not found! Create it?`);
                    const argv = await prompt.get([{
                        name: 'create',
                        type: 'string',
                        required: true,
                        default: 'y/N'
                    }]);

                    if (argv.create.toLowerCase() !== 'y') continue;

                    await s3.createBucket({
                        Bucket: full
                    }).promise();
                }
            }
        }
    }
}

module.exports = Init;
