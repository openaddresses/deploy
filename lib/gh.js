import fs from 'fs';

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

        this.headers = {
            accept: 'application/vnd.github.v3+json',
            'User-Agent': `openaddresses-deploy@${pkg.version}`,
            'Content-Type': 'application/vnd.github.flash-preview+json'
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
        if (success === undefined) success = 'pending';
        else if (success) success = 'success';
        else if (!success) success = 'failed';

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

    async deployment_list(stack) {
        const url = new URL(this.url + `/repos/${this.context.owner}/${this.context.repo}/deployments`);
        url.searchParams.append('sha', this.context.sha);
        url.searchParams.append('task', 'deploy');
        url.searchParams.append('environment', stack);

        const res = await fetch(url, {
            method: 'GET',
            headers: this.headers,
            auth: {
                user: this.context.user,
                password: this.context.github
            }
        });

        const body = await res.json();

        if (body.length > 0) return body[0].id;
        return false;
    }

    async deployment_create(stack) {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.context.repo}/deployments`, {
            method: 'POST',
            headers: this.headers,
            auth: {
                user: this.context.user,
                password: this.context.github
            },
            body: {
                ref: this.context.sha,
                task: 'deploy',
                environment: stack,
                production_environment: ['prod', 'production'].includes(stack)
            }
        });

        const body = await res.json();
        this.context.deployment = body.id;

        return true;
    }

    /**
     * Create or update a deploy status on github.com
     *
     * @param {string} stack The stackname to update
    */
    async deployment_update(stack, success) {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.context.repo}/deployments/${this.context.deployment}/statuses`, {
            method: 'POST',
            headers: this.headers,
            auth: {
                user: this.context.user,
                password: this.context.github
            },
            body: {
                state: success
            }
        });

        return await res.json();
    }

    /**
     * delete a deployment on github.com
    */
    async deployment_delete() {
        const res = await fetch(this.url + `/repos/${this.context.owner}/${this.context.repo}/deployments/${this.context.deployment}`, {
            method: 'DELETE',
            headers: this.headers,
            auth: {
                user: this.context.user,
                password: this.context.github
            }
        });

        return await res.json();
    }
}
