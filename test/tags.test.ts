import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InfoOutput } from '@openaddresses/cfn-config';
import Tags from '../lib/tags.js';
import type { DeployContext } from '../lib/types.js';

const prompt = vi.hoisted(() => vi.fn());

vi.mock('inquirer', () => ({
    default: { prompt }
}));

const context = { tags: ['Project', 'Owner', { Key: 'Client', Value: 'cotak' }] } as unknown as DeployContext;

const existing = (tags: Record<string, string>): InfoOutput => ({ Tags: new Map(Object.entries(tags)) } as unknown as InfoOutput);

const asked = (): string[] => (prompt.mock.calls[0]?.[0] as { name: string }[] | undefined)?.map((question) => question.name) ?? [];

describe('Tags.request', () => {
    afterEach(() => {
        prompt.mockReset();
    });

    it('prompts for every tag by default, fixed ones included, with known values as defaults', async () => {
        prompt.mockResolvedValue({ Project: 'p', Owner: 'o', Client: 'c' });

        const tags = await Tags.request(context, existing({ Project: 'frontend-infra', Owner: 'nik' }));

        expect(asked()).toEqual(['Project', 'Owner', 'Client']);
        expect((prompt.mock.calls[0][0] as { name: string, default?: string }[]).map((question) => question.default)).toEqual(['frontend-infra', 'nik', 'cotak']);
        expect(tags).toEqual([
            { Key: 'Project', Value: 'p' },
            { Key: 'Owner', Value: 'o' },
            { Key: 'Client', Value: 'c' }
        ]);
    });

    it('with reuse, asks nothing when the stack already carries every tag', async () => {
        const tags = await Tags.request(context, existing({ Project: 'frontend-infra', Owner: 'nik' }), true);

        expect(prompt).not.toHaveBeenCalled();
        expect(tags).toEqual([
            { Key: 'Project', Value: 'frontend-infra' },
            { Key: 'Owner', Value: 'nik' },
            { Key: 'Client', Value: 'cotak' }
        ]);
    });

    it('with reuse, asks only for a tag nobody knows', async () => {
        prompt.mockResolvedValue({ Owner: 'typed' });

        const tags = await Tags.request(context, existing({ Project: 'frontend-infra' }), true);

        expect(asked()).toEqual(['Owner']);
        expect(tags).toContainEqual({ Key: 'Owner', Value: 'typed' });
        expect(tags).toContainEqual({ Key: 'Project', Value: 'frontend-infra' });
    });
});
