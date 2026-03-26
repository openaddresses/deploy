import fs from 'node:fs';
import ora from 'ora';
import Git from './git.js';
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
        const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };

        this.repo = Git.repo();
        this.enabled = Boolean(context.github);
        this.headers = {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${context.github ?? ''}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': `openaddresses-deploy@${pkg.version}`,
            'Content-Type': 'application/json'
        };
        this.context = context;
    }

    async deployment(stack: string, success?: boolean): Promise<void> {
        if (!this.enabled) {
            return;
        }

        const state = this.deploymentState(success);

        if (state === 'pending' && this.context.force !== true) {
            try {
                await this.pollStatusChecks(this.context.githubPolling);
            } catch (error) {
                const err = asError(error);
                console.error(`Status Check Polling Failed: ${err.message}`);
                process.exit(1);
            }
        }

        if (this.context.deployment) {
            await this.deployment_update(stack, state);
            return;
        }

        const deploymentId = await this.deployment_list(stack);
        if (!deploymentId) {
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

        const body = await response.json() as GitHubCheckRunsResponse;
        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Status, skipping due to --force');
                return { check_runs: [] };
            }

            console.error(body);
            throw new Error('Could not list status checks');
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

                await new Promise((resolve) => setTimeout(resolve, interval));
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
        const body = await response.json() as GitHubDeployment[];

        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment List, skipping due to --force');
                return false;
            }

            console.error(body);
            throw new Error('Could not list deployments');
        }

        return body.length > 0 ? body[0].id : false;
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
        const body = await response.json() as GitHubDeployment;

        if (!response.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Creation, skipping due to --force');
                return;
            }

            console.error(body);
            throw new Error('Could not create deployment');
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

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
