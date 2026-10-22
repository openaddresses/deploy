import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Credentials from '../lib/context.js';
import Git from '../lib/git.js';
import type { DeployArgv } from '../lib/types.js';

vi.mock('../lib/git.js', () => ({
    default: {
        user: vi.fn(() => 'testuser'),
        owner: vi.fn(() => 'testowner'),
        repo: vi.fn(() => 'testrepo'),
        sha: vi.fn(() => 'abc123'),
        root: vi.fn(() => '/tmp/fake-root')
    }
}));

vi.mock('@aws-sdk/credential-providers', () => ({
    fromIni: vi.fn(() => async () => ({
        accessKeyId: 'NOTAREALACCESSKEY',
        secretAccessKey: 'l33t/10xeNg1n33r/EXAMPLEKEY'
    }))
}));

vi.mock('@aws-sdk/client-sts', () => ({
    STSClient: class MockSTSClient {
        send(): Promise<{ Account: string }> {
            return Promise.resolve({ Account: '123456789012' });
        }
    },
    GetCallerIdentityCommand: class MockGetCallerIdentityCommand {}
}));

const cfnCalls = vi.hoisted(() => ({ options: undefined as Record<string, unknown> | undefined }));

vi.mock('@openaddresses/cfn-config', () => ({
    default: class MockCFN {
        constructor(_client: unknown, options: Record<string, unknown>) {
            cfnCalls.options = options;
        }
    }
}));

function makeArgv(overrides: Partial<DeployArgv> = {}): DeployArgv {
    return {
        _: ['node', 'deploy', 'list'],
        template: false,
        force: false,
        ...overrides
    } as DeployArgv;
}

function mockRcFile(content: Record<string, unknown>): void {
    const original = fs.readFileSync.bind(fs);
    vi.spyOn(fs, 'readFileSync').mockImplementation(((filePath: fs.PathOrFileDescriptor, options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null) => {
        if (String(filePath).endsWith('.deployrc.json')) {
            return JSON.stringify(content);
        }

        return original(filePath, options as never);
    }) as typeof fs.readFileSync);
}

describe('Credentials.generate', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('region precedence', () => {
        it('defaults to us-east-1 when nothing is configured', async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe('us-east-1');
        });

        it('uses the profile region from ~/.deployrc.json when --region is not given', async () => {
            mockRcFile({ default: { region: 'eu-west-1' } });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe('eu-west-1');
        });

        it('uses the dotdeploy region when no --region', async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                region: 'us-west-2'
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe('us-west-2');
        });

        it('dotdeploy region takes precedence over profile region from ~/.deployrc.json', async () => {
            mockRcFile({ default: { region: 'eu-central-1' } });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                region: 'us-west-2'
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe('us-west-2');
        });

        it('--region overrides profile region from ~/.deployrc.json', async () => {
            mockRcFile({ default: { region: 'eu-west-1' } });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv({ region: 'ap-southeast-1' }));

            expect(creds.region).toBe('ap-southeast-1');
        });

        it('--region overrides dotdeploy region', async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                region: 'us-west-2'
            });

            const creds = await Credentials.generate(makeArgv({ region: 'ca-central-1' }));

            expect(creds.region).toBe('ca-central-1');
        });
    });

    describe('profile selection', () => {
        it('auto-selects the only profile when one exists in ~/.deployrc.json', async () => {
            mockRcFile({ myprofile: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.profile).toBe('myprofile');
        });

        it('uses --profile to select one of multiple profiles', async () => {
            mockRcFile({ staging: {}, production: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv({ profile: 'staging' }));

            expect(creds.profile).toBe('staging');
        });

        it('uses the profile specified in the dotdeploy file', async () => {
            mockRcFile({ staging: {}, production: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                profile: 'production'
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.profile).toBe('production');
        });

        it('throws when multiple profiles exist and --profile is not specified', async () => {
            mockRcFile({ staging: {}, production: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow('Multiple deploy profiles found');
        });

        it('each profile carries its own region independently', async () => {
            mockRcFile({
                us: { region: 'us-east-1' },
                eu: { region: 'eu-west-1' }
            });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv({ profile: 'eu' }));

            expect(creds.region).toBe('eu-west-1');
        });
    });

    describe('role precedence', () => {
        it('passes no roleArn when nothing is configured', async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.role).toBe('');
            expect(cfnCalls.options?.roleArn).toBeUndefined();
        });

        it('uses the profile role from ~/.deployrc.json', async () => {
            mockRcFile({ default: { role: 'arn:aws:iam::123456789012:role/profile-role' } });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.role).toBe('arn:aws:iam::123456789012:role/profile-role');
            expect(cfnCalls.options?.roleArn).toBe('arn:aws:iam::123456789012:role/profile-role');
        });

        it('dotdeploy role takes precedence over profile role', async () => {
            mockRcFile({ default: { role: 'arn:aws:iam::123456789012:role/profile-role' } });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                role: 'arn:aws:iam::123456789012:role/project-role'
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.role).toBe('arn:aws:iam::123456789012:role/project-role');
        });

        it('--role overrides dotdeploy role', async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                role: 'arn:aws:iam::123456789012:role/project-role'
            });

            const creds = await Credentials.generate(makeArgv({ role: 'arn:aws:iam::123456789012:role/flag-role' }));

            expect(creds.role).toBe('arn:aws:iam::123456789012:role/flag-role');
        });

        it('renders template variables in the role', async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue({
                region: 'us-gov-east-1',
                role: 'arn:{{partition}}:iam::{{accountId}}:role/{{project}}-{{stack}}-{{region}}'
            });

            const creds = await Credentials.generate(makeArgv({ _: ['update', 'staging'] }));

            expect(creds.role).toBe('arn:aws-us-gov:iam::123456789012:role/testrepo-staging-us-gov-east-1');
            expect(cfnCalls.options?.roleArn).toBe('arn:aws-us-gov:iam::123456789012:role/testrepo-staging-us-gov-east-1');
        });
    });

    describe('partition', () => {
        it('derives the partition from the region', () => {
            expect(Credentials.partition('us-east-1')).toBe('aws');
            expect(Credentials.partition('us-gov-east-1')).toBe('aws-us-gov');
            expect(Credentials.partition('cn-north-1')).toBe('aws-cn');
        });
    });

    describe('git validation', () => {
        it('throws when not inside a git repository', async () => {
            vi.mocked(Git.repo).mockReturnValueOnce(null as never);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow('No Git Repo detected');
        });

        it('throws when the current git sha cannot be determined', async () => {
            vi.mocked(Git.sha).mockReturnValueOnce(null as never);
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow('Could not determine git sha');
        });
    });

    describe('rc file schema validation', () => {
        it('throws when ~/.deployrc.json has an unrecognised property', async () => {
            mockRcFile({ default: { unknownKey: 'value' } });
            vi.spyOn(Credentials, 'dot_deploy').mockReturnValue(false);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow('~/.deployrc.json does not conform to schema');
        });
    });
});
