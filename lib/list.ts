import minimist from 'minimist';
import { ListStacksCommand, CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { DescribeRegionsCommand, EC2Client } from '@aws-sdk/client-ec2';
import type { DeployArgv, DeployContext } from './types.js';

export default class List {
    static short = 'List all stack assoc. with the current repo';

    static help(): void {
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

    static async main(context: DeployContext, argvInput: string[]): Promise<void> {
        const argv = minimist(argvInput, {
            boolean: ['all'],
            string: ['region']
        }) as DeployArgv;

        if (argv.all && argv.region) {
            throw new Error('--all & --region cannot be used together');
        }

        const regions: string[] = [];

        if (argv.all) {
            const ec2 = new EC2Client({
                credentials: context.aws,
                region: context.region
            });
            const response = await ec2.send(new DescribeRegionsCommand({}));
            for (const region of response.Regions ?? []) {
                if (region.RegionName) {
                    regions.push(region.RegionName);
                }
            }
        } else {
            regions.push(argv.region ?? context.region);
        }

        for (const region of regions) {
            const cloudFormation = new CloudFormationClient({
                region,
                credentials: context.aws
            });

            console.log(`# Region: ${region}`);

            let nextToken: string | undefined;
            do {
                const response = await cloudFormation.send(new ListStacksCommand({
                    NextToken: nextToken,
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

                for (const stack of response.StackSummaries ?? []) {
                    if (stack.StackName && new RegExp(`^${context.repo}-`).test(stack.StackName)) {
                        console.log(stack.StackName, stack.StackStatus, stack.CreationTime);
                    }
                }

                nextToken = response.NextToken;
            } while (nextToken);
        }
    }
}
