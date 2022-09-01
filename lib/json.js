import { Template } from '@openaddresses/cfn-config';
import tagger from './tagger.js';

/**
 * @class
 */
export default class Json {
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
        let template = await Template.read(new URL(creds.template, 'file://'));
        template = tagger(template, creds.tags);
        console.log(JSON.stringify(template));
    }
}
