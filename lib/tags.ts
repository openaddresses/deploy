import inquirer from 'inquirer';
import type { InfoOutput } from '@openaddresses/cfn-config';
import type { DeployContext, DeployTag } from './types.js';

export default class Tags extends Array<DeployTag> {
    /**
     * Collect the stack's tags: the fixed ones from .deploy, the rest asked
     * for with the existing stack's values as defaults. With `reuse`, a tag
     * that already has a value (fixed or on the stack) is not asked about;
     * only tags nobody knows yet are prompted.
     */
    static async request(context: DeployContext, existingTemplate: InfoOutput | null, reuse = false): Promise<Tags> {
        const tags = new Tags();
        const known: Record<string, string> = {};

        if (existingTemplate?.Tags) {
            for (const key of existingTemplate.Tags.keys()) {
                const value = existingTemplate.Tags.get(key);
                if (value !== undefined) {
                    known[key] = value;
                }
            }
        }

        const tagSet = new Set<string>();
        for (const tag of context.tags) {
            if (typeof tag !== 'string') {
                known[tag.Key] = tag.Value;
                tagSet.add(tag.Key);
            } else {
                tagSet.add(tag);
            }
        }

        const request = Array.from(tagSet).map((tag) => ({
            type: 'input' as const,
            name: tag,
            default: known[tag],
            message: `${tag}. CloudFormation Tag Value:`
        }));

        const toAsk = reuse ? request.filter((question) => question.default === undefined) : request;

        const responses = {
            ...known,
            ...(toAsk.length ? await inquirer.prompt<Record<string, string>>(toAsk) : {})
        };

        for (const [Key, Value] of Object.entries(responses)) {
            tags.push({ Key, Value });
        }

        return tags;
    }
}
