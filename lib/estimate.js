'use strict';

const minimist = require('minimist');
const cf = require('@mapbox/cfn-config');
const AWS = require('aws-sdk');

/**
 * @class
 */
class Estimate {
    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Get a cost esimate for the CF Template');
        console.log();
        console.log('Usage: deploy estimate [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help           show this help message');
        console.log();
    }

    /**
     * Obtain estimate info about a given stack
     *
     * @param {Credentials} creds Credentials
     * @param {Object} argv Program arguments
     */
    static async main(creds, argv) {
        argv = minimist(argv, {});

        const stack = argv._[3];

        const cf = new AWS.CloudFormation({
            region: creds.region
        });

        try {
            const TemplateBody = JSON.stringify(creds.template.json);
            const Parameters = [];

            await cf.estimateTemplateCost({
                TemplateBody,
                Parameters
            }).promise();
        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = Estimate;
