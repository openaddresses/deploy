import { describe, expect, it } from 'vitest';
import Version from '../lib/version.js';

function fetchStub(body: unknown, ok = true): typeof fetch {
    return (async () => ({
        ok,
        json: async () => body
    })) as unknown as typeof fetch;
}

describe('Version', () => {
    it('reads the current package version', () => {
        expect(Version.current()).toMatch(/^\d+\.\d+\.\d+/);
    });

    it('compares semver-style versions', () => {
        expect(Version.isNewer('10.8.0', '10.7.1')).toBe(true);
        expect(Version.isNewer('11.0.0', '10.99.99')).toBe(true);
        expect(Version.isNewer('10.7.1', '10.7.1')).toBe(false);
        expect(Version.isNewer('10.7.0', '10.7.1')).toBe(false);
        expect(Version.isNewer('10.8.0-beta.1', '10.7.1')).toBe(true);
        expect(Version.isNewer('v10.8', '10.7.1')).toBe(true);
    });

    it('resolves the latest published version', async () => {
        await expect(Version.latest(fetchStub({ version: '99.0.0' }))).resolves.toBe('99.0.0');
    });

    it('returns null when the registry is unreachable or malformed', async () => {
        await expect(Version.latest(fetchStub({}, false))).resolves.toBeNull();
        await expect(Version.latest(fetchStub({ version: 7 }))).resolves.toBeNull();
        await expect(Version.latest((async () => { throw new Error('offline'); }) as unknown as typeof fetch)).resolves.toBeNull();
    });

    it('is disabled by DEPLOY_NO_UPDATE_CHECK or CI', () => {
        expect(Version.enabled({})).toBe(true);
        expect(Version.enabled({ DEPLOY_NO_UPDATE_CHECK: '1' })).toBe(false);
        expect(Version.enabled({ CI: 'true' })).toBe(false);
    });

    it('prints a notice only when a newer version exists', async () => {
        const lines: string[] = [];
        const log = (msg: string) => lines.push(msg);

        await expect(Version.check({ env: {}, fetchFn: fetchStub({ version: '99.0.0' }), log })).resolves.toBe('99.0.0');
        expect(lines.join('\n')).toContain(`${Version.current()} -> 99.0.0`);
        expect(lines.join('\n')).toContain('npm install -g @openaddresses/deploy');

        lines.length = 0;
        await expect(Version.check({ env: {}, fetchFn: fetchStub({ version: '0.0.1' }), log })).resolves.toBeNull();
        expect(lines).toEqual([]);

        await expect(Version.check({ env: { CI: '1' }, fetchFn: fetchStub({ version: '99.0.0' }), log })).resolves.toBeNull();
        expect(lines).toEqual([]);
    });
});
