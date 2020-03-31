'use strict';

class Env {
    static help() {
        console.log();
        console.log('Usage: deploy env');
        console.log();
        console.log('Export AWS_ environment variables into current shell');
        console.log();
    }

    static main(creds) {
        console.log(`export AWS_DEFAULT_REGION=${creds.region}`);
        console.log(`export AWS_ACCESS_KEY_ID=${creds.accessKeyId}`);
        console.log(`export AWS_SECRET_ACCESS_KEY=${creds.secretAccessKey}`);

        console.error(`ok - [${creds.profile}] environment configured`);
    }
}

module.exports = Env;
