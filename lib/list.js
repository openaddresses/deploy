import { CloudFormationClient, ListStacksCommand } from '@aws-sdk/client-cloudformation';
import { EC2Client, DescribeRegionsCommand } from '@aws-sdk/client-ec2';
import minimist from 'minimist';

/**
 * @class
 */
export default class List {
    static short = 'List all stack assoc. with the current repo';

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
     *
     * @param {Context} context
     * @param {Object} argv
     */
    static async main(context, argv) {
        argv = minimist(argv, {
            boolean: ['all'],
            string: ['region']
        });

        if (argv.all && argv.region) throw new Error('--all & --region cannot be used together');

        const regions = [];

        if (argv.all) {
            const ec2 = new EC2Client({
                credentials: context.aws,
                region: context.region
            });

            (await ec2.send(new DescribeRegionsCommand())).Regions.forEach((region) => {
                regions.push(region.Endpoint.replace('ec2.', '').replace('.amazonaws.com', ''));
            });
        } else {
            regions.push(context.region);
        }

        for (const region of regions) {
            const cf = new CloudFormationClient({
                region, credentials: context.aws
            });

            console.log(`# Region: ${region}`);

            let res;
            do {
                res = await cf.send(new ListStacksCommand({
                    NextToken: res ? res.NextToken : undefined,
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
                }));

                for (const stack of res.StackSummaries) {
                    if (stack.StackName.match(new RegExp(`^${context.repo}-`))) {
                        console.log(stack.StackName, stack.StackStatus, stack.CreationTime);
                    }
                }
            } while (res.NextToken);
        }
    }
}
