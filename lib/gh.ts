import { setTimeout as sleep } from 'node:timers/promises';
import ora from 'ora';
import Git from './git.js';
import Version from './version.js';
import { asError, isRecord } from './util.js';
import type { DeployContext, GitHubPollingConfig } from './types.js';

type DeploymentState = 'pending' | 'success' | 'failure';

interface GitHubCheckRun {
    name?: string;
    status?: string;
    conclusion?: string | null;
}

interface GitHubCheckRunsResponse {
    check_runs?: GitHubCheckRun[];
}

interface GitHubDeployment {
    id: number;
}

export default class GH {
    readonly url = 'https://api.github.com';
    readonly repo: string;
    readonly enabled: boolean;
    readonly headers: Record<string, string>;
    readonly context: DeployContext;

    constructor(context: DeployContext) {
        this.repo = Git.repo();
        this.enabled = Boolean(context.github);
        this.headers = {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${context.github ?? ''}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': `openaddresses-deploy@${Version.current()}`,
            'Content-Type': 'application/json'
        };
        this.context = context;
    }

    async deployment(stack: string, success?: boolean): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const state = this.deploymentState(success);

        if (state === 'pending' && !this.context.force) {
            try {
                await this.pollStatusChecks(this.context.githubPolling);
            } catch (error) {
                const err = asError(error);
                console.error(`Status Check Polling Failed: ${err.message}`);
                process.exit(1);
            }
        }

        if (this.context.deployment !== false) {
            await this.deployment_update(stack, state);
            return;
        }

        const deploymentId = await this.deployment_list(stack);
        if (deploymentId === false) {
            await this.deployment_create(stack);
            if (state !== 'pending') {
                await this.deployment_update(stack, state);
            }
            return;
        }

        this.context.deployment = deploymentId;
        await this.deployment_update(stack, state);
    }

    async status(): Promise<GitHubCheckRunsResponse> {
        const response = await fetch(`${this.url}/repos/${this.context.owner}/${this.repo}/commits/${this.context.sha}/check-runs`, {
            method: 'GET',
            headers: this.headers
        });

        const body: unknown = await response.json();
        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Status, skipping due to --force');
                return { check_runs: [] };
            }

            console.error(body);
            throw new Error('Could not list status checks');
        }

        if (!isCheckRunsResponse(body)) {
            throw new Error('Unexpected GitHub check runs response');
        }

        return body;
    }

    async pollStatusChecks(options: Partial<GitHubPollingConfig> = {}): Promise<void> {
        const timeout = options.timeout ?? 30 * 60 * 1000;
        const interval = options.interval ?? 30 * 1000;
        const startTime = Date.now();
        const progress = ora(`GitHub Status Checks: ${this.context.sha}`).start();

        try {
            while (Date.now() - startTime < timeout) {
                const status = await this.status();
                const checks = status.check_runs ?? [];

                if (checks.length === 0) {
                    progress.info(`No status checks associated with ${this.context.sha}`)
                    return;
                }
                
                const completed = checks.filter((check) => check.status === 'completed');
                const failed = completed.filter((check) => {
                    const conclusion = check.conclusion ?? '';
                    return !['success', 'neutral', 'skipped'].includes(conclusion);
                });

                progress.text = `GitHub Status Checks: (${checks.length} checks)`;

                if (failed.length > 0) {
                    const names = failed.map((check) => check.name ?? 'unknown').join(', ');
                    throw new Error(`Status checks failed: ${names}`);
                }

                if (checks.length > 0 && completed.length === checks.length) {
                    progress.succeed();
                    return;
                }

                await sleep(interval);
            }

            progress.fail(`GitHub Status Checks: Timeout after ${timeout / 1000 / 60} minutes`);
            throw new Error(`Timeout waiting for status checks to complete after ${timeout / 1000 / 60} minutes`);
        } catch (error) {
            if (progress.isSpinning) {
                progress.fail('GitHub Status Checks: Failed');
            }

            throw error;
        }
    }

    async deployment_list(stack: string): Promise<number | false> {
        const url = new URL(`${this.url}/repos/${this.context.owner}/${this.repo}/deployments`);
        url.searchParams.append('sha', this.context.sha);
        url.searchParams.append('task', 'deploy');
        url.searchParams.append('environment', stack);

        const response = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });
        const body: unknown = await response.json();

        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment List, skipping due to --force');
                return false;
            }

            console.error(body);
            throw new Error('Could not list deployments');
        }

        const list: unknown[] = Array.isArray(body) ? body : [];
        const first = list.find((item) => isDeployment(item));

        return first === undefined ? false : first.id;
    }

    async deployment_create(stack: string): Promise<void> {
        const response = await fetch(`${this.url}/repos/${this.context.owner}/${this.repo}/deployments`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                ref: this.context.sha,
                task: 'deploy',
                environment: stack,
                production_environment: ['prod', 'production'].includes(stack)
            })
        });
        const body: unknown = await response.json();

        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Creation, skipping due to --force');
                return;
            }

            console.error(body);
            throw new Error('Could not create deployment');
        }

        if (!isDeployment(body)) {
            throw new Error('Unexpected GitHub deployment response');
        }

        this.context.deployment = body.id;
    }

    async deployment_update(_stack: string, success: DeploymentState): Promise<unknown> {
        const response = await fetch(`${this.url}/repos/${this.context.owner}/${this.repo}/deployments/${this.context.deployment}/statuses`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                state: success
            })
        });
        const body = await response.json() as unknown;

        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Update, skipping due to --force');
                return body;
            }

            console.error(body);
            throw new Error('Could not create deployment');
        }

        return body;
    }

    async deployment_delete(): Promise<unknown> {
        const response = await fetch(`${this.url}/repos/${this.context.owner}/${this.repo}/deployments/${this.context.deployment}`, {
            method: 'DELETE',
            headers: this.headers
        });
        const body = await response.json() as unknown;

        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Deletion skipping due to --force');
                return body;
            }

            console.error(body);
            throw new Error('Could not delete deployment');
        }

        return body;
    }

    private deploymentState(success?: boolean): DeploymentState {
        if (success === undefined) {
            return 'pending';
        }

        return success ? 'success' : 'failure';
    }
}

function isCheckRunsResponse(body: unknown): body is GitHubCheckRunsResponse {
    return isRecord(body) && (body.check_runs === undefined || Array.isArray(body.check_runs));
}

function isDeployment(body: unknown): body is GitHubDeployment {
    return isRecord(body) && typeof body.id === 'number';
}
