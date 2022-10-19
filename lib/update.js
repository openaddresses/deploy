/**
 * @class
 */
export default class Update {
    static short = 'Update an existing stack of the current repo';

    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Update a CloudFormation stack');
        console.log();
        console.log('Usage: deploy update <stack> [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }
}
