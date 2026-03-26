import type { DeployContext } from './types.js';

export default class Json {
    static short = 'Return the JSONified version of the CF template';

    static help(): void {
        console.log();
        console.log('Return the JSONified CloudFormation template');
        console.log();
        console.log('Usage: deploy json [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help           show this help message');
        console.log();
    }

    static async main(context: DeployContext): Promise<void> {
        if (!context.template) {
            throw new Error('Template path is not configured');
        }

        const template = await context.cfn.template.read(new URL(context.template, 'file://'));
        console.log(JSON.stringify(template.body));
    }
}
