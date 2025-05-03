import fs from 'fs';
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
            headers: this.headers,
        });

        const body = await res.json();

        if (!res.ok) {
            console.error(body);
            throw new Error('Could not list status checks');
        } else {
            if (body.state === 'pending') {

            }
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
