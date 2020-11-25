'use strict';

const docker = require('./artifacts/docker').check;
const lambda = require('./artifacts/lambda').check;

/**
 * Check if desired artifacts are present before deploying
 *
 * @param {Credentials} creds Credentials
 * @param {function} cb Callback function
 */
async function check(creds, cb) {
    try {
        await docker(creds);
        await lambda(creds);
    } catch (err) {
        return cb(err);
    }

    return cb(null, true);
}

module.exports = check;

