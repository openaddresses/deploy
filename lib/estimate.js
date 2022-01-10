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
    static main(creds, argv) {
        argv = minimist(argv, {});

        if (!argv._[3]) return console.error('Stack name required: run deploy info --help');

        const stack = argv._[3];

        const cf = new AWS.CloudFormation({
            region: creds.region
        });

        cf.estimateTemplateCost({
            TemplateBody: cf.info
        });
    }
}

module.exports = Estimate;
