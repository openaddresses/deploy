import cp from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import inquirer from 'inquirer';
import { parseArgs } from 'node:util';
import Git from './git.js';
import type { DeployArgv } from './types.js';

export interface AwsConfigProfile {
    name: string;
    region?: string;
    ssoAccountId?: string;
    ssoRoleName?: string;
    ssoSession?: string;
    ssoStartUrl?: string;
}

interface ResolveProfileOptions {
    target?: string;
    account?: string;
    profile?: string;
    role?: string;
    defaultProfile?: string;
    profiles: Record<string, AwsConfigProfile>;
}

type AwsConfigRecord = Record<string, AwsConfigProfile>;

export interface AwsSsoSession {
    name: string;
    ssoStartUrl?: string;
    ssoRegion?: string;
}

export default class SSO {
    static short = 'Log into an AWS SSO profile or account';

    static help(): void {
        console.log();
        console.log('Usage: deploy sso [<profile>|<account-id>] [--role <name>] [--profile <name>]');
        console.log();
        console.log('Log into an AWS account via an AWS CLI SSO profile');
        console.log();
        console.log('[options]:');
        console.log('    --profile <name>        AWS CLI profile name to log in with');
        console.log('    --account <id>          AWS account ID to match against SSO profiles');
        console.log('    --role <name>           Narrow an account match to a specific SSO role');
        console.log();
    }

    static async main(argvInput: string[]): Promise<void> {
        const { values, positionals } = parseArgs({
            args: argvInput,
            options: {
                help: { type: 'boolean' },
                profile: { type: 'string' },
                account: { type: 'string' },
                role: { type: 'string' }
            },
            allowPositionals: true,
            strict: false
        });

        const argv = { ...values, _: positionals } as DeployArgv;
        const profiles = this.readAwsConfig();
        const defaultProfile = this.readDotDeployProfile();
        const profile = await this.resolveProfile({
            target: argv._[1],
            account: argv.account,
            profile: argv.profile,
            role: argv.role,
            defaultProfile,
            profiles
        });

        this.login(profile);
        console.error(`ok - [${profile}] SSO session configured`);
        console.error(`ok - use with: deploy <command> --profile ${profile}, or export AWS_PROFILE=${profile}`);
    }

    static parseSsoSessions(raw: string): Record<string, AwsSsoSession> {
        const sessions: Record<string, AwsSsoSession> = {};
        let current: AwsSsoSession | undefined;

        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                continue;
            }

            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const section = trimmed.slice(1, -1).trim();
                current = section.startsWith('sso-session ') ? { name: section.slice('sso-session '.length).trim() } : undefined;
                if (current) {
                    sessions[current.name] = current;
                }

                continue;
            }

            if (!current) {
                continue;
            }

            const index = trimmed.search(/[=:]/);
            if (index === -1) {
                continue;
            }

            const key = trimmed.slice(0, index).trim();
            const value = trimmed.slice(index + 1).trim();

            if (key === 'sso_start_url') {
                current.ssoStartUrl = value;
            } else if (key === 'sso_region') {
                current.ssoRegion = value;
            }
        }

        return sessions;
    }

    static missingSession(profileName: string, raw?: string): string | undefined {
        let config = raw;

        if (config === undefined) {
            try {
                config = fs.readFileSync(path.resolve(os.homedir(), '.aws', 'config'), 'utf8');
            } catch {
                return undefined;
            }
        }

        const profile = this.parseAwsConfig(config)[profileName];
        if (!profile?.ssoSession || this.parseSsoSessions(config)[profile.ssoSession]) {
            return undefined;
        }

        return `AWS profile ${profileName} references sso_session ${profile.ssoSession} but no [sso-session ${profile.ssoSession}] section exists in ~/.aws/config`;
    }

    static parseAwsConfig(raw: string): AwsConfigRecord {
        const profiles: AwsConfigRecord = {};
        let current: AwsConfigProfile | undefined;

        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
                continue;
            }

            if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
                const section = trimmed.slice(1, -1).trim();
                const name = this.profileNameFromSection(section);

                current = name ? { name } : undefined;
                if (current) {
                    profiles[current.name] = current;
                }

                continue;
            }

            if (!current) {
                continue;
            }

            const delimiter = trimmed.includes('=') ? '=' : ':';
            const index = trimmed.indexOf(delimiter);
            if (index === -1) {
                continue;
            }

            const key = trimmed.slice(0, index).trim();
            const value = trimmed.slice(index + 1).trim();

            switch (key) {
                case 'region':
                    current.region = value;
                    break;
                case 'sso_account_id':
                    current.ssoAccountId = value;
                    break;
                case 'sso_role_name':
                    current.ssoRoleName = value;
                    break;
                case 'sso_session':
                    current.ssoSession = value;
                    break;
                case 'sso_start_url':
                    current.ssoStartUrl = value;
                    break;
                default:
                    break;
            }
        }

        return profiles;
    }

    static async resolveProfile(options: ResolveProfileOptions): Promise<string> {
        const requestedProfile = options.profile ?? this.profileTarget(options.target);
        if (requestedProfile) {
            return this.resolveNamedProfile(requestedProfile, options.profiles);
        }

        const accountId = options.account ?? this.accountTarget(options.target);
        if (accountId) {
            const matches = this.matchingProfiles(options.profiles, { accountId, role: options.role });
            return this.pickProfile(matches, `No AWS SSO profile found for account ${accountId}`);
        }

        if (options.defaultProfile) {
            return this.resolveNamedProfile(options.defaultProfile, options.profiles);
        }

        const candidates = Object.values(options.profiles)
            .filter((profile) => this.isSsoProfile(profile))
            .sort((left, right) => left.name.localeCompare(right.name));

        return this.pickProfile(candidates, 'No AWS SSO profiles found in ~/.aws/config');
    }

    static readAwsConfig(configPath = path.resolve(os.homedir(), '.aws', 'config')): AwsConfigRecord {
        let raw: string;
        try {
            raw = fs.readFileSync(configPath, 'utf8');
        } catch (error) {
            const err = error as NodeJS.ErrnoException;
            if (err.code === 'ENOENT') {
                throw new Error('AWS config not found at ~/.aws/config. Run aws configure sso first.', {
                    cause: error
                });
            }

            throw error;
        }

        return this.parseAwsConfig(raw);
    }

    static readDotDeployProfile(dotDeployPath?: string): string | undefined {
        const attempts = dotDeployPath ? [dotDeployPath] : [path.resolve(process.cwd(), '.deploy')];

        if (!dotDeployPath) {
            try {
                attempts.push(path.resolve(Git.root(), '.deploy'));
            } catch {
                // not in a git repo
            }
        }

        for (const attempt of new Set(attempts)) {
            if (!fs.existsSync(attempt)) {
                continue;
            }

            const parsed = JSON.parse(fs.readFileSync(attempt, 'utf8')) as { profile?: unknown };
            if (typeof parsed.profile === 'string' && parsed.profile) {
                return parsed.profile;
            }
        }

        return undefined;
    }

    static describeProfile(profile: AwsConfigProfile): string {
        const details = [profile.ssoAccountId, profile.ssoRoleName].filter(Boolean).join(' / ');
        return details ? `${profile.name} (${details})` : profile.name;
    }

    private static accountTarget(target?: string): string | undefined {
        if (target && /^\d{12}$/.test(target)) {
            return target;
        }

        return undefined;
    }

    private static profileNameFromSection(section: string): string | undefined {
        if (section === 'default') {
            return 'default';
        }

        if (section.startsWith('profile ')) {
            return section.slice('profile '.length).trim();
        }

        return undefined;
    }

    private static profileTarget(target?: string): string | undefined {
        if (!target || this.accountTarget(target)) {
            return undefined;
        }

        return target;
    }

    private static isSsoProfile(profile: AwsConfigProfile): boolean {
        return Boolean(profile.ssoSession || profile.ssoStartUrl);
    }

    private static resolveNamedProfile(name: string, profiles: AwsConfigRecord): string {
        const profile = profiles[name];

        if (!profile) {
            throw new Error(`AWS profile ${name} not found in ~/.aws/config`);
        }

        if (!this.isSsoProfile(profile)) {
            throw new Error(`AWS profile ${name} is not configured for SSO`);
        }

        const missing = this.missingSession(name);
        if (missing) {
            throw new Error(missing);
        }

        return name;
    }

    private static matchingProfiles(profiles: AwsConfigRecord, options: { accountId: string; role?: string }): AwsConfigProfile[] {
        return Object.values(profiles)
            .filter((profile) => this.isSsoProfile(profile))
            .filter((profile) => profile.ssoAccountId === options.accountId)
            .filter((profile) => !options.role || profile.ssoRoleName === options.role)
            .sort((left, right) => left.name.localeCompare(right.name));
    }

    private static async pickProfile(candidates: AwsConfigProfile[], emptyMessage: string): Promise<string> {
        if (candidates.length === 0) {
            throw new Error(emptyMessage);
        }

        if (candidates.length === 1) {
            return candidates[0].name;
        }

        const answer = await inquirer.prompt<{ profile: string }>({
            type: 'select',
            name: 'profile',
            message: 'AWS SSO Profile',
            choices: candidates.map((profile) => ({
                name: this.describeProfile(profile),
                value: profile.name
            }))
        });

        return answer.profile;
    }

    static isSsoProfileName(profileName: string, raw?: string): boolean {
        let config = raw;

        if (config === undefined) {
            try {
                config = fs.readFileSync(path.resolve(os.homedir(), '.aws', 'config'), 'utf8');
            } catch {
                return false;
            }
        }

        const profile = this.parseAwsConfig(config)[profileName];
        return profile ? this.isSsoProfile(profile) : false;
    }

    static login(profile: string): void {
        const child = cp.spawnSync('aws', ['sso', 'login', '--profile', profile], {
            stdio: 'inherit'
        });

        if (child.error) {
            const err = child.error as NodeJS.ErrnoException;
            if (err.code === 'ENOENT') {
                throw new Error('AWS CLI not found. Install AWS CLI v2 to use deploy sso.', {
                    cause: child.error
                });
            }

            throw err;
        }

        if (child.status !== 0) {
            throw new Error(`aws sso login failed with exit code ${child.status ?? 'unknown'}`);
        }
    }
}