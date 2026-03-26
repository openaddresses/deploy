export default class Delete {
    static short = 'Delete an existing stack of the current repo';

    static help(): void {
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
