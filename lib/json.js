import CFN from '@openaddresses/cfn-config';

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
     * @param {Credentials} creds Credentials
     */
    static async main(creds) {
        const cfn = new CFN({
            region: creds.region,
            credentials: creds.aws
        });

        const template = await Template.read(new URL(creds.template, 'file://'));
        console.log(JSON.stringify(template));
    }
}
