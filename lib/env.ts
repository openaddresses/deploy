import type { DeployContext } from './types.js';

export default class Env {
    static short = 'Setup AWS env vars in current shell';

    static help(): void {
        console.log();
        console.log('Usage: deploy env');
        console.log();
        console.log('Export AWS_ environment variables into current shell');
        console.log();
    }

    static async main(context: DeployContext): Promise<void> {
        console.log(`export AWS_ACCOUNT_ID=${await context.accountId()}`);
        console.log(`export AWS_REGION=${context.region}`);
        console.log(`export AWS_ACCESS_KEY_ID=${context.aws.accessKeyId}`);
        console.log(`export AWS_SECRET_ACCESS_KEY=${context.aws.secretAccessKey}`);

        if (context.aws.sessionToken) {
            console.log(`export AWS_SESSION_TOKEN=${context.aws.sessionToken}`);
        }

        console.error(`ok - [${context.profile}] environment configured`);
    }
}
