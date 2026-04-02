import Table from 'cli-table';
import { parseArgs } from 'node:util';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { InfoOutput } from '@openaddresses/cfn-config';
import type { DeployArgv, DeployContext } from './types.js';

export default class Info {
    static short = 'Get information on a specific stack within the current repo';

    static help(): void {
        console.log();
        console.log('Get info about a specific stack in the current repo');
        console.log();
        console.log('Usage: deploy info <stack> [--output|-o] [--parameters|-p] [--help]');
        console.log();
        console.log('Options:');
        console.log('  --outputs            Print stack outputs in a table');
        console.log('  --parameters         Print stack parameters in a table');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }

    static async main(context: DeployContext, argvInput: string[]): Promise<void> {
        const { values } = parseArgs({
            args: argvInput,
            options: {
                output: { type: 'boolean' },
                outputs: { type: 'boolean' },
                parameter: { type: 'boolean' },
                parameters: { type: 'boolean' },
                help: { type: 'boolean' },
            },
            allowPositionals: true,
            strict: false,
        });
        const argv = { ...values, _: [] } as DeployArgv;

        if (!context.stack) {
            console.error('Stack name required: run deploy info --help');
            return;
        }

        const secretsManager = new SecretsManagerClient({
            credentials: context.aws,
            region: context.region
        });

        const info = await context.cfn.lookup.info(`${context.repo}-${context.name}`);
        await this.resolveSecrets(secretsManager, info);

        const showParameters = Boolean(argv.parameter || argv.parameters);
        const showOutputs = Boolean(argv.output || argv.outputs);

        if (showParameters) {
            this.table('Parameters', Object.fromEntries(info.Parameters));
        }

        if (showOutputs) {
            this.table('Outputs', Object.fromEntries(info.Outputs));
        }

        if (!showOutputs && !showParameters) {
            console.log(JSON.stringify(info, (_key, value) => {
                if (value instanceof Map) {
                    return Object.fromEntries(value);
                }

                return value;
            }, 4));
        }
    }

    static table(name: string, kv: Record<string, string>): void {
        const table = new Table({
            head: ['Name', 'Value']
        });

        for (const [key, value] of Object.entries(kv)) {
            table.push([key, value]);
        }

        console.log();
        console.log(`${name}:`);
        console.log(table.toString());
        console.log();
    }

    private static async resolveSecrets(secretsManager: SecretsManagerClient, info: InfoOutput): Promise<void> {
        for (const key of info.Outputs.keys()) {
            const outputValue = info.Outputs.get(key);
            if (!outputValue || !/{{resolve:secretsmanager:.*}}/.test(outputValue)) {
                continue;
            }

            const matches = outputValue.match(/{{resolve:secretsmanager:.*?}}/g) ?? [];
            let resolvedOutput = outputValue;

            for (const match of matches) {
                const parsed = match.replace(/{{resolve:secretsmanager:/, '').replace(/}}/, '').split(':');
                const secretId = parsed[0];
                const responseField = parsed[1] || 'SecretString';
                const jsonKey = parsed[2] || '';
                const versionStage = parsed[3] || 'AWSCURRENT';

                if (!secretId) {
                    throw new Error('Secret Name Missing in resolve');
                }

                const secret = await secretsManager.send(new GetSecretValueCommand({
                    SecretId: secretId,
                    VersionStage: versionStage
                }));

                let value = responseField === 'SecretString' ? secret.SecretString : undefined;
                if (jsonKey) {
                    const parsedSecret = JSON.parse(secret.SecretString ?? '{}') as Record<string, string>;
                    value = parsedSecret[jsonKey];
                }

                resolvedOutput = resolvedOutput.replace(match, value ?? '');
            }

            info.Outputs.set(key, resolvedOutput);
        }
    }
}
