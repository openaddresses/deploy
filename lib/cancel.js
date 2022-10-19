/**
 * @class
 */
export default class Cancel {
    static short = 'Cancel a stack update, rolling it back';

    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Cancel a deploy to an stack, rolling it back');
        console.log();
        console.log('Usage: deploy cancel <stack> [--help]');
        console.log();
        console.log('Options:');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log();
    }
}
