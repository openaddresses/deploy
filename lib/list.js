'use strict';

const AWS = require('aws-sdk');

/**
 * @class List
 */
class List {
    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Usage: deploy list');
        console.log();
        console.log('List all of the currently running stacks deployed from the current repo');
        console.log();
        console.log('[options]:');
        console.log('    --region  <region>      Override default region to perform operations in');
        console.log();
    }

    /**
     * List current stacks deployed to a given profile
     */
    static async main(creds) {
        const cloudformation = new AWS.CloudFormation({
            region: creds.region
        });

        const res = await cloudformation.listStacks({
            // All but "DELETE_COMPLETE"
            StackStatusFilter: [
                'CREATE_IN_PROGRESS',
                'CREATE_FAILED',
                'CREATE_COMPLETE',
                'ROLLBACK_IN_PROGRESS',
                'ROLLBACK_FAILED',
                'ROLLBACK_COMPLETE',
                'DELETE_IN_PROGRESS',
                'DELETE_FAILED',
                'UPDATE_IN_PROGRESS',
                'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS',
                'UPDATE_COMPLETE',
                'UPDATE_ROLLBACK_IN_PROGRESS',
                'UPDATE_ROLLBACK_FAILED',
                'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
                'UPDATE_ROLLBACK_COMPLETE'
            ]
        }).promise();

        for (const stack of res.StackSummaries) {
            if (stack.StackName.match(new RegExp(`^${creds.repo}-`))) {
                console.error(stack.StackName, stack.StackStatus, stack.CreationTime);
            }
        }
    }
}

module.exports = List;
