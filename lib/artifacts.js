import docker from './artifacts/docker.js';
import lambda from './artifacts/lambda.js';

/**
 * Check if desired artifacts are present before deploying
 *
 * @param {Credentials} creds Credentials
 */
export default async function check(creds) {
    await docker(creds);
    await lambda(creds);

    return true;
}

