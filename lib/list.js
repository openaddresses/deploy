import AWS from 'aws-sdk';
import minimist from 'minimist';

/**
 * @class
 */
export default class List {
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
        console.log('    --all                   Query all regions for deployed stacks');
        console.log();
    }

    /**
     * List current stacks deployed to a given profile
     */
    static async main(creds, argv) {
        argv = minimist(argv, {
            boolean: ['all'],
            string: ['region']
        });

        if (argv.all && argv.region) throw new Error('--all & --region cannot be used together');

        const regions = [];

        if (argv.all) {
            const ec2 = new AWS.EC2({
                region: creds.region
            });

            (await ec2.describeRegions().promise()).Regions.forEach((region) => {
                regions.push(region.Endpoint.replace('ec2.', '').replace('.amazonaws.com', ''));
            });
        } else {
            regions.push(creds.region);
        }

        for (const region of regions) {
            const cloudformation = new AWS.CloudFormation({ region });

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

            console.log(`# Region: ${region}`);
            for (const stack of res.StackSummaries) {
                if (stack.StackName.match(new RegExp(`^${creds.repo}-`))) {
                    console.log(stack.StackName, stack.StackStatus, stack.CreationTime);
                }
            }
        }
    }
}
