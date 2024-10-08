import inquirer from 'inquirer';

/**
 * @class
 */
export default class Tags extends Array {
    static async request(context, existingTemplate) {
        const tags = new Tags();

        const known = {};

        // Put external known tags on object first so they are
        // intentially overridden by local tags (if they exist) next
        // IE: Owner: <your email> should be overritten
        if (existingTemplate && existingTemplate.Tags) {
            for (const key of existingTemplate.Tags.keys()) {
                known[key] = existingTemplate.Tags.get(key);
            }
        }

        const tagSet = new Set();
        for (const tag of context.tags) {
            if (typeof tag !== 'string') {
                known[tag.Key] = tag.Value;
                tagSet.add(tag.Key);
            } else {
                tagSet.add(tag);
            }
        }

        const request = [];
        for (const tag of tagSet) {
            request.push({
                type: 'input',
                name: tag,
                default: known[tag],
                message: `${tag}. Cloudformation Tag Value:`
            });
        }

        const responses = Object.assign(known, await inquirer.prompt(request));
        for (const Key in responses) {
            tags.push({ Key, Value: responses[Key] });
        }

        return tags;
    }
}
