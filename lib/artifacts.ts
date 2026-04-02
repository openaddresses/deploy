import docker from './artifacts/docker.js';
import s3 from './artifacts/s3.js';
import type { DeployContext } from './types.js';

export default async function check(context: DeployContext): Promise<true> {
    await docker(context);
    await s3(context);

    return true;
}
