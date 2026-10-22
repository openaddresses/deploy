import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import inquirer from 'inquirer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SSO from '../lib/sso.js';

vi.mock('inquirer', () => ({
    default: {
        prompt: vi.fn()
    }
}));

function awsConfigFixture(): string {
    return [
        '[default]',
        'region = us-east-1',
        '',
        '[profile staging-admin]',
        'sso_session = company',
        'sso_account_id = 123456789012',
        'sso_role_name = AdministratorAccess',
        '',
        '[profile staging-readonly]',
        'sso_start_url = https://example.awsapps.com/start',
        'sso_account_id = 123456789012',
        'sso_role_name = ReadOnly',
        '',
        '[profile production-admin]',
        'sso_session = company',
        'sso_account_id = 210987654321',
        'sso_role_name = AdministratorAccess',
        '',
        '[profile static-creds]',
        'region = us-west-2',
        '',
        '[sso-session company]',
        'sso_start_url = https://example.awsapps.com/start'
    ].join('\n');
}

describe('SSO', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('parseAwsConfig', () => {
        it('extracts profile sections and preserves SSO account metadata', () => {
            const profiles = SSO.parseAwsConfig(awsConfigFixture());

            expect(profiles['staging-admin']).toMatchObject({
                name: 'staging-admin',
                ssoSession: 'company',
                ssoAccountId: '123456789012',
                ssoRoleName: 'AdministratorAccess'
            });
            expect(profiles['staging-readonly']).toMatchObject({
                name: 'staging-readonly',
                ssoStartUrl: 'https://example.awsapps.com/start',
                ssoAccountId: '123456789012',
                ssoRoleName: 'ReadOnly'
            });
            expect(profiles.default).toMatchObject({
                name: 'default'
            });
            expect(profiles).not.toHaveProperty('company');
        });
    });

    describe('resolveProfile', () => {
        it('accepts an explicit SSO profile name', async () => {
            const profile = await SSO.resolveProfile({
                target: 'staging-admin',
                profiles: SSO.parseAwsConfig(awsConfigFixture())
            });

            expect(profile).toBe('staging-admin');
        });

        it('rejects an explicit profile that is not configured for SSO', async () => {
            await expect(SSO.resolveProfile({
                target: 'static-creds',
                profiles: SSO.parseAwsConfig(awsConfigFixture())
            })).rejects.toThrow('AWS profile static-creds is not configured for SSO');
        });

        it('matches a unique account id directly', async () => {
            const profile = await SSO.resolveProfile({
                target: '210987654321',
                profiles: SSO.parseAwsConfig(awsConfigFixture())
            });

            expect(profile).toBe('production-admin');
        });

        it('filters an account id match by role name', async () => {
            const profile = await SSO.resolveProfile({
                target: '123456789012',
                role: 'ReadOnly',
                profiles: SSO.parseAwsConfig(awsConfigFixture())
            });

            expect(profile).toBe('staging-readonly');
        });

        it('prompts when an account id matches multiple SSO profiles', async () => {
            vi.mocked(inquirer.prompt).mockResolvedValueOnce({
                profile: 'staging-readonly'
            });

            const profile = await SSO.resolveProfile({
                target: '123456789012',
                profiles: SSO.parseAwsConfig(awsConfigFixture())
            });

            expect(profile).toBe('staging-readonly');
            expect(inquirer.prompt).toHaveBeenCalledOnce();
        });

        it('falls back to a default profile from .deploy semantics', async () => {
            const profile = await SSO.resolveProfile({
                defaultProfile: 'production-admin',
                profiles: SSO.parseAwsConfig(awsConfigFixture())
            });

            expect(profile).toBe('production-admin');
        });
    });

    describe('readDotDeployProfile', () => {
        it('reads a profile from a .deploy file in the current working directory', () => {
            const tempDir = fs.mkdtempSync(path.resolve(os.tmpdir(), 'deploy-sso-'));
            const dotDeployPath = path.resolve(tempDir, '.deploy');

            fs.writeFileSync(dotDeployPath, JSON.stringify({
                profile: 'staging-admin'
            }));

            expect(SSO.readDotDeployProfile(dotDeployPath)).toBe('staging-admin');
        });
    });
});