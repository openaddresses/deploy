import Table from 'cli-table';
import ora from 'ora';
import { parseArgs } from 'node:util';
import {
    CloudFormationClient,
    DetectStackDriftCommand,
    DescribeStackDriftDetectionStatusCommand,
    DescribeStackResourceDriftsCommand
} from '@aws-sdk/client-cloudformation';
import type { DeployContext } from './types.js';

export default class Drift {
    static short = 'Print a CloudFormation Drift table for a stack';

    static help(): void {
        console.log();
        console.log('Detect and display CloudFormation drift for a specific stack');
        console.log();
        console.log('Usage: deploy drift <stack> [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }

    static async main(context: DeployContext, argvInput: string[]): Promise<void> {
        parseArgs({
            args: argvInput,
            options: {
                help: { type: 'boolean' }
            },
            allowPositionals: true,
            strict: false
        });

        if (!context.stack) {
            console.error('Stack name required: run deploy drift --help');
            return;
        }

        const stackName = `${context.repo}-${context.name}`;

        const cloudFormation = new CloudFormationClient({
            credentials: context.aws,
            region: context.region
        });

        const progress = ora(`Drift Detection: ${stackName}`).start();

        let StackDriftDetectionId: string | undefined;
        while (!StackDriftDetectionId) {
            try {
                const result = await cloudFormation.send(new DetectStackDriftCommand({
                    StackName: stackName
                }));
                StackDriftDetectionId = result.StackDriftDetectionId;
            } catch (error) {
                const err = error as Error;
                if (err.message.includes('already in progress')) {
                    progress.text = `Waiting for existing drift detection to complete: ${stackName}`;
                    await new Promise<void>((resolve) => setTimeout(resolve, 5000));
                } else {
                    progress.fail();
                    throw err;
                }
            }
        }

        if (!StackDriftDetectionId) {
            progress.fail();
            throw new Error('Failed to initiate drift detection: no detection ID returned');
        }

        progress.text = `Drift Detection: ${stackName}`;

        // Poll until drift detection completes
        let detectionStatus = 'DETECTION_IN_PROGRESS';
        while (detectionStatus === 'DETECTION_IN_PROGRESS') {
            await new Promise<void>((resolve) => setTimeout(resolve, 5000));

            const status = await cloudFormation.send(new DescribeStackDriftDetectionStatusCommand({
                StackDriftDetectionId
            }));

            detectionStatus = status.DetectionStatus ?? 'DETECTION_FAILED';

            if (detectionStatus === 'DETECTION_FAILED') {
                progress.fail();
                throw new Error(`Drift detection failed: ${status.DetectionStatusReason ?? 'unknown reason'}`);
            }
        }

        progress.succeed();

        // Collect all drifted resources (paginated)
        const drifts = [];
        let nextToken: string | undefined;
        do {
            const response = await cloudFormation.send(new DescribeStackResourceDriftsCommand({
                StackName: stackName,
                StackResourceDriftStatusFilters: ['MODIFIED', 'DELETED', 'NOT_CHECKED'],
                NextToken: nextToken
            }));

            for (const drift of response.StackResourceDrifts ?? []) {
                drifts.push(drift);
            }

            nextToken = response.NextToken;
        } while (nextToken);

        if (drifts.length === 0) {
            console.log('\nNo drift detected — stack is IN_SYNC.\n');
            return;
        }

        const table = new Table({
            head: ['Logical ID', 'Resource Type', 'Drift Status', 'Physical ID']
        });

        for (const drift of drifts) {
            const status = drift.StackResourceDriftStatus ?? '';
            const coloredStatus = status === 'MODIFIED'
                ? `\x1b[33m${status}\x1b[0m`
                : status === 'DELETED'
                    ? `\x1b[31m${status}\x1b[0m`
                    : status;

            table.push([
                drift.LogicalResourceId ?? '',
                drift.ResourceType ?? '',
                coloredStatus,
                drift.PhysicalResourceId ?? ''
            ]);
        }

        console.log();
        console.log(`Drift results for ${stackName}:`);
        console.log(table.toString());
        console.log();
    }
}
