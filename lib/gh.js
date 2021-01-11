const request = require('request');
const pkg = require('../package.json');

class GH {
     /**
     * Create a new github API object
     *
     * @constructor
     * @param {Credentials} creds Credentials object
     */
    constructor(creds) {
        this.url = 'https://api.github.com';

        this.headers = {
            accept: 'application/vnd.github.v3+json',
            'User-Agent': `openaddresses-deploy@${pkg.version}`,
            'Content-Type': 'application/vnd.github.flash-preview+json'
        };

        this.creds = creds;
    }

    /**
     * Create or update a deploy status on github.com
     *
     * @param {string} stack The stackname to update
    */
    async deployment(stack) {
        return new Promise((resolve, reject) => {
            request({
                url: this.url + `/repos/${this.creds.owner}/${this.creds.repo}/deployments`,
                method: 'POST',
                headers: this.headers,
                auth: {
                    user: this.creds.user,
                    password: this.creds.github
                },
                body: JSON.stringify({
                    ref: this.creds.sha,
                    task: 'deploy',
                    environment: stack,
                    production_environment: ['prod', 'production'].includes(stack)
                })
            }, (err, res) => {
                if (err) return reject(err);

                console.error(res.statusCode);
                console.error(res.body);

                return resolve();
            });
        });
    }
}

module.exports = GH;
