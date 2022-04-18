/**
 * Add additional global tags
 *
 * @returns {Object} template
 * @returns {Array} tags
 */
export default function tagger(template, tags) {
    // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-resource-specification.html
    const schema = require('../data/cf_schema.json');

    if (!template.Resources) return template;
    if (!tags || !tags.length) return template;
    if (!template.Parameters) template.Parameters = {};

    for (const tag of tags) {
        if (typeof tag === 'string') {
            template.Parameters[tag] = {
                Type: 'String',
                Description: 'Tag for the stack'
            };
        }
    }

    for (const name of Object.keys(template.Resources)) {
        if (
            !template.Resources[name].Type
            || !schema.ResourceTypes[template.Resources[name].Type]
            || !schema.ResourceTypes[template.Resources[name].Type].Properties
            || !schema.ResourceTypes[template.Resources[name].Type].Properties.Tags
        ) continue;

        const special = [];
        if (schema.ResourceTypes[template.Resources[name].Type].Properties.Tags.ItemType === 'TagProperty') {
            special.push(['PropagateAtLaunch', true]);
        }

        if (!template.Resources[name].Properties) {
            template.Resources[name].Properties = {};
        }

        if (!template.Resources[name].Properties.Tags) {
            template.Resources[name].Properties.Tags = [];
        }

        const tag_names = template.Resources[name].Properties.Tags.map((t) => t.Key);

        for (const oTag of tags) {
            if (tag_names.includes(oTag)) {
                for (const tag of template.Resources[name].Properties.Tags) {
                    if (tag.Key === oTag && typeof oTag === 'string') {
                        tag.Value = {
                            Ref: oTag
                        };

                        break;
                    } else if (tag.Key === oTag && typeof oTag === 'object') {
                        tag.Value = oTag.Value;
                        break;
                    }
                }
            } else {
                if (typeof oTag === 'string') {
                    template.Resources[name].Properties.Tags.push({
                        Key: oTag,
                        Value: {
                            Ref: oTag
                        }
                    });
                } else if (typeof oTag === 'object') {
                    template.Resources[name].Properties.Tags.push({
                        Key: oTag.Key,
                        Value: oTag.Value
                    });
                }
            }
        }

        template.Resources[name].Properties.Tags = template.Resources[name].Properties.Tags.map((tag) => {
            tag = JSON.parse(JSON.stringify(tag));

            special.forEach((s) => {
                tag[s[0]] = s[1];
            });

            return tag;
        });
    }

    return template;
}
