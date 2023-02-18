/**
 * @class
 */
export default class Json {
    static short = 'Return the JSONified version of the CF template';

    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Return the JSONified Cloudformation Template');
        console.log();
        console.log('Usage: deploy json [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help           show this help message');
        console.log();
    }

    /**
     * Output a JSONified version of the cloudformation template
     *
     * @param {Context} context Context
     */
    static async main(context) {
        const template = await context.cfn.template.read(new URL(context.template, 'file://'));
        console.log(JSON.stringify(template));
    }
}
