import docker from './artifacts/docker.js';
import lambda from './artifacts/lambda.js';

/**
 * Check if desired artifacts are present before deploying
 *
 * @param {Context} context Context
 */
export default async function check(context) {
    await docker(context);
    await lambda(context);

    return true;
}

