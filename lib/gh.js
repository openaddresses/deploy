import fs from 'fs';
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
        if (success === undefined) {
            success = 'pending';
        } else if (success) {
            success = 'success';
        } else if (!success) {
            success = 'failed';
        }

        await this.status();

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
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.repo}/commits/${this.context.sha}/status`, {
            method: 'GET',
            headers: this.headers
        });

        const body = await res.json();

        if (!res.ok) {
            console.error(body);
            throw new Error('Could not list status checks');
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

        console.log(`Polling GitHub status checks for commit ${this.context.sha}...`);

        while (Date.now() - startTime < timeout) {
            try {
                const status = await this.status();

                console.log(`Status: ${status.state} (${status.statuses?.length || 0} checks)`);

                if (status.state === 'success') {
                    console.log('✅ All status checks passed!');
                    return true;
                } else if (status.state === 'failure') {
                    const failedChecks = status.statuses?.filter((s) => s.state === 'failure') || [];
                    const errorMessage = failedChecks.length > 0
                        ? `Failed checks: ${failedChecks.map((c) => c.context).join(', ')}`
                        : 'Some status checks failed';
                    throw new Error(`❌ Status checks failed. ${errorMessage}`);
                } else if (status.state === 'error') {
                    const errorChecks = status.statuses?.filter((s) => s.state === 'error') || [];
                    const errorMessage = errorChecks.length > 0
                        ? `Error in checks: ${errorChecks.map((c) => c.context).join(', ')}`
                        : 'Some status checks encountered errors';
                    throw new Error(`❌ Status checks encountered errors. ${errorMessage}`);
                } else if (status.state === 'pending') {
                    const pendingChecks = status.statuses?.filter((s) => s.state === 'pending') || [];
                    if (pendingChecks.length > 0) {
                        console.log(`⏳ Waiting for: ${pendingChecks.map((c) => c.context).join(', ')}`);
                    }

                    // Wait before next poll
                    await new Promise((resolve) => setTimeout(resolve, interval));
                } else {
                    // Handle unexpected states
                    console.log(`⚠️ Unexpected status state: ${status.state}`);
                    await new Promise((resolve) => setTimeout(resolve, interval));
                }
            } catch (error) {
                if (error.message.includes('Status checks failed') || error.message.includes('encountered errors')) {
                    throw error; // Re-throw status check failures
                }

                console.error(`Error polling status checks: ${error.message}`);
                await new Promise((resolve) => setTimeout(resolve, interval));
            }
        }

        throw new Error(`❌ Timeout waiting for status checks to complete after ${timeout / 1000 / 60} minutes`);
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
            console.error(body);
            throw new Error('Could not list deployments');
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
            console.error(body);
            throw new Error('Could not create deployment');
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
            console.error(body);
            throw new Error('Could not create deployment');
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
            console.error(body);
            throw new Error('Could not delete deployment');
        } else {
            return body;
        }
    }
}
