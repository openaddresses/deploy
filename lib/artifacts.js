'use strict';

const docker = require('./artifacts/docker').check;
const lambda = require('./artifacts/lambda').check;
const Q = require('d3-queue').queue;

async function check(creds, cb) {
    try {
        await docker(creds);
        await lambda(creds);
    } catch(err) {
        return cb(err);
    }

    return cb(null, true);
}

module.exports = check;

