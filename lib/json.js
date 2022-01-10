'use strict';

/**
 * @class
 */
class Json {
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
    static main(creds) {
        console.log(JSON.stringify(creds.template.json));
    }
}

module.exports = Json;
