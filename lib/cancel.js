import Table from 'cli-table';
import minimist from 'minimist';
import cf from '@openaddresses/cfn-config';
import AWS from 'aws-sdk';

/**
 * @class
 */
export default class Cancel {
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
