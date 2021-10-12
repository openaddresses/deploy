'use strict';

const docker = require('./artifacts/docker').check;
const lambda = require('./artifacts/lambda').check;

/**
 * Check if desired artifacts are present before deploying
 *
 * @param {Credentials} creds Credentials
 */
async function check(creds) {
    await docker(creds);
    await lambda(creds);

    return true;
}

module.exports = check;

