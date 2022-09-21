import inquirer from 'inquirer';

/**
 * @class
 */
export default class Tags extends Array {
    static async request(rawtags) {
        const tags = new Tags();

        const known = {};
        for (const tag of rawtags) {
            if (typeof tag !== 'string') {
                known[tag.Key] = tag.Value;
            }
        }

        const request = [];
        for (const tag of rawtags) {
            if (typeof tag === 'string' && !known[tag]) {
                request.push({
                    type: 'input',
                    name: tag,
                    message: `${tag}. Cloudformation Tag Value:`
                });
            }
        }

        const responses = Object.assign(known, await inquirer.prompt(request));
        for (const Key in responses) {
            tags.push({ Key, Value: responses[Key] });
        }

        return tags;
    }
}
