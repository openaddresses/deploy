const AWS = require('aws-sdk');

class List {
    static help() {
        console.log();
        console.log('Usage: deploy list');
        console.log();
        console.log('List all of the currently running stacks deployed from the current repo');
        console.log()
    }

    static main(creds, argv) {
        const cloudformation = new AWS.CloudFormation({
            region: creds.region
        });

        cloudformation.listStacks({
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
        }, (err, res) => {
            if (err) throw err;

            for (let stack of res.StackSummaries) {
                if (stack.StackName.match(new RegExp(`^${creds.repo}-`))) {
                    console.error(stack.StackName, stack.StackStatus, stack.CreationTime);
                }
            }
        });
    }
}

module.exports = List;
