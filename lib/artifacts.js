import docker from './artifacts/docker.js';
import s3 from './artifacts/s3.js';

/**
 * Check if desired artifacts are present before deploying
 *
 * @param {Context} context Context
 */
export default async function check(context) {
    await docker(context);
    await s3(context);

    return true;
}

