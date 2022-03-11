'use strict';

const minimist = require('minimist');
const CFN = require('@openaddresses/cfn-config');
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
        console.log('Usage: deploy estimate <stack> [--help]');
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
        const cfn = new AWS.CloudFormation({
            region: creds.region
        });

        //TODO check if stack is actually a path

        try {
            const info = JSON.stringify(await CFN.Lookup.info(`${creds.repo}-${stack}`, creds.region, true, false));

            const TemplateBody = (await cfn.getTemplate({
                StackName: `${creds.repo}-${stack}`
            }).promise()).TemplateBody;

            const questions = CFN.Template.questions(TemplateBody, {
                region: creds.region
            });

            const Parameters = await CFN.Prompt.parameters(questions);

            const res = await cfn.estimateTemplateCost({
                TemplateBody,
                Parameters
            }).promise();

        } catch (err) {
            console.error(err);
        }
    }
}

module.exports = Estimate;
