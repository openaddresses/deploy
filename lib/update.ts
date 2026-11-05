export default class Update {
    static short = 'Update an existing stack of the current repo';

    static help(): void {
        console.log();
        console.log('Update a CloudFormation stack');
        console.log();
        console.log('Usage: deploy update <stack> [--help]');
        console.log();
        console.log('Options:');
        console.log('  --drift              Create a Drift Aware Changeset');
        console.log('  --reuse-parameters   Take every parameter and tag the stack already has from the stack;');
        console.log('                       prompt only for new ones. For deploys that change only the code.');
        console.log('  --help               show this help message');
        console.log('  --region  <region>   Override default region to perform operations in');
        console.log('  --role    <arn>      IAM Service Role CloudFormation assumes to perform the operation');
        console.log();
    }
}
