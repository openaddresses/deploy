/**
 * @class
 */
export default class Create {
    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Create a new CloudFormation stack');
        console.log();
        console.log('Usage: deploy create <stack> [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }
}
