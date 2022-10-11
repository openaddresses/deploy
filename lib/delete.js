/**
 * @class
 */
export default class Delete {
    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Delete a CloudFormation stack');
        console.log();
        console.log('Usage: deploy delete <stack> [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }
}
