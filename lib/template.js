const friend = require('@mapbox/cloudfriend');
const tagger = require('./tagger');

/**
 * @class
 * Store information about a CloudFormation Template
 *
 * @param {string} path Path to CF Template
 */
class Template {
    constructor(path) {
        this.path = path;
        this.json = false;
    }

    async build(tags = {}) {
        const template = await friend.build(creds.template);
        this.json = tagger(template, tags);

        return true;
    }
}

module.exports = Template;
