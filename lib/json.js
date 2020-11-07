'use strict';

const friend = require('@mapbox/cloudfriend');

class Json {
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

    static main(creds, argv) {
        friend.build(creds.template).then((template) => {
            console.log(JSON.stringify(template));
        });
    }
}

module.exports = Json;
