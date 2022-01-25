'use strict';

const cf = require('@openaddresses/cfn-config');

/**
 * @class
 * A wrapper around CFN-Config to allow promise based use
 */
class CFN {
    constructor(creds) {
        this.cf = cf.preauth(creds);

        this.commands = cf.commands({
            name: creds.repo,
            region: creds.region,
            configBucket: `cfn-config-active-${creds.accountId}-${creds.region}`,
            templateBucket: `cfn-config-templates-${creds.accountId}-${creds.region}`
        });
    }

    create(name, path, opts) {
        return new Promise((resolve, reject) =>{
            this.commands.create(name, path, opts, (err, res) => {
                if (err) return reject(err);
                return resolve(res);
            });
        });
    }

    update(name, path, opts) {
        return new Promise((resolve, reject) => {
            this.commands.update(name, path, opts, (err, res) => {
                if (err) return reject(err);
                return resolve(res);
            });
        });
    }

    delete(name) {
        return new Promise((resolve, reject) => {
            this.commands.delete(name, (err, res) => {
                if (err) return reject(err);
                return resolve(res);
            });
        });
    }
}

module.exports = CFN;
