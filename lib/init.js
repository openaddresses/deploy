'use strict';

const fs = require('fs');
const path = require('path');
const prompt = require('prompt');

/**
 * @class Init
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
    static main() {
        prompt.message = '$';
        prompt.start();

        prompt.get([{
            name: 'profile',
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
        },{
            name: 'accessKeyId',
            type: 'string',
            required: true
        },{
            name: 'secretAccessKey',
            hidden: true,
            replace: '*',
            required: true,
            type: 'string'
        }], (err, argv) => {
            if (err) return console.error(`deploy init failed: ${err.message}`);

            fs.readFile(path.resolve(process.env.HOME, '.deployrc.json'), (err, creds) => {

                if (err) {
                    creds = {};
                } else {
                    creds = JSON.parse(creds);
                }

                creds[argv.profile] = {
                    region: argv.region,
                    accountId: argv.accountId,
                    accessKeyId: argv.accessKeyId,
                    secretAccessKey: argv.secretAccessKey
                };

                fs.writeFileSync(path.resolve(process.env.HOME, '.deployrc.json'), JSON.stringify(creds, null, 4));
            });
        });
    }
}

module.exports = Init;
