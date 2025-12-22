import fs from 'node:fs';
import ora from 'ora';
import Git from './git.js';

/**
 * @class
 */
export default class GH {
    /**
     * Create a new github API object
     *
     * @constructor
     * @param {Context} context Context object
     */
    constructor(context) {
        this.url = 'https://api.github.com';
        const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));

        this.repo = Git.repo();

        this.enabled = context.github;

        this.headers = {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${context.github}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': `openaddresses-deploy@${pkg.version}`,
            'Content-Type': 'application/json'
        };

        this.context = context;
    }

    /**
     * Create or update a deploy status on github.com
     *
     * @param {string} stack The stackname to update
     * @param {boolean} success Was the deployment successful
     */
    async deployment(stack, success) {
        if (!this.enabled) return;

        if (success === undefined) {
            success = 'pending';
        } else if (success) {
            success = 'success';
        } else if (!success) {
            success = 'failed';
        }

        // Poll GitHub status checks before proceeding with deployment
        try {
            await this.pollStatusChecks(this.context.githubPolling);
        } catch (err) {
            console.error(`Status Check Polling Failed: ${err.message}`);
            process.exit(1);
        }

        if (this.context.deployment) {
            return await this.deployment_update(stack, success);
        } else {
            const deploy_id = await this.deployment_list(stack);

            if (!deploy_id) {
                await this.deployment_create(stack);
            } else {
                this.context.deployment = deploy_id;

                await this.deployment_update(stack, success);
            }
        }
    }

    async status() {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.repo}/commits/${this.context.sha}/check-runs`, {
            method: 'GET',
            headers: this.headers
        });

        const body = await res.json();

        if (!res.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Status, skipping due to --force');
            } else {
                console.error(body);
                throw new Error('Could not list status checks');
            }
        }

        return body;
    }

    /**
     * Poll GitHub status checks until they pass or fail
     *
     * @param {Object} options - Polling options
     * @param {number} options.timeout - Timeout in milliseconds (default: 30 minutes)
     * @param {number} options.interval - Poll interval in milliseconds (default: 30 seconds)
     * @returns {Promise<boolean>} - True if checks pass, throws error if they fail
     */
    async pollStatusChecks(options = {}) {
        const timeout = options.timeout || 30 * 60 * 1000; // 30 minutes default
        const interval = options.interval || 30 * 1000; // 30 seconds default
        const startTime = Date.now();

        const progress = ora(`GitHub Status Checks: ${this.context.sha}`).start();

        try {
            while (Date.now() - startTime < timeout) {
                try {
                    const status = await this.status();

                    progress.text = `GitHub Status Checks: (${status.check_runs?.length || 0} checks)`;

                    const completed = status.check_runs?.filter((s) => s.status === 'completed') || [];

                    if (completed.length === status.check_runs?.length) {
                        progress.succeed();
                        return;
                    };

                    await new Promise((resolve) => setTimeout(resolve, interval));
                } catch (error) {
                    if (error.message.includes('Status checks failed') || error.message.includes('encountered errors')) {
                        throw error; // Re-throw status check failures
                    }

                    progress.text = `GitHub Status Checks: Error - ${error.message}`;
                    await new Promise((resolve) => setTimeout(resolve, interval));
                }
            }

            progress.fail(`GitHub Status Checks: Timeout after ${timeout / 1000 / 60} minutes`);
            throw new Error(`❌ Timeout waiting for status checks to complete after ${timeout / 1000 / 60} minutes`);
        } catch (error) {
            // Ensure we clean up the spinner if it's still running
            if (progress.isSpinning) {
                progress.fail('GitHub Status Checks: Failed');
            }
            throw error;
        }
    }

    async deployment_list(stack) {
        const url = new URL(this.url + `/repos/${this.context.owner}/${this.repo}/deployments`);
        url.searchParams.append('sha', this.context.sha);
        url.searchParams.append('task', 'deploy');
        url.searchParams.append('environment', stack);

        const res = await fetch(url, {
            method: 'GET',
            headers: this.headers
        });

        const body = await res.json();

        if (!res.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment List, skipping due to --force');
            } else {
                console.error(body);
                throw new Error('Could not list deployments');
            }
        } else {
            if (body.length > 0) return body[0].id;
            return false;
        }
    }

    async deployment_create(stack) {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.repo}/deployments`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                ref: this.context.sha,
                task: 'deploy',
                environment: stack,
                production_environment: ['prod', 'production'].includes(stack)
            })
        });

        const body = await res.json();

        if (!res.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Creation, skipping due to --force');
            } else {
                console.error(body);
                throw new Error('Could not create deployment');
            }
        } else {
            this.context.deployment = body.id;
            return true;
        }
    }

    /**
     * Create or update a deploy status on github.com
     *
     * @param {string} stack The stackname to update
    */
    async deployment_update(stack, success) {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.repo}/deployments/${this.context.deployment}/statuses`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                state: success
            })
        });

        const body = await res.json();

        if (!res.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Update, skipping due to --force');
            } else {
                console.error(body);
                throw new Error('Could not create deployment');
            }
        } else {
            return body;
        }
    }

    /**
     * delete a deployment on github.com
    */
    async deployment_delete() {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.repo}/deployments/${this.context.deployment}`, {
            method: 'DELETE',
            headers: this.headers
        });

        const body = await res.json();
        if (!res.ok) {
            if (this.context.force) {
                console.log('warn - Error in Github Deployment Deletion skipping due to --force');
            } else {
                console.error(body);
                throw new Error('Could not delete deployment');
            }
        } else {
            return body;
        }
    }
}
