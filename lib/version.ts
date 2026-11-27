import fs from 'node:fs';
import { isRecord, parseJson } from './util.js';

const REGISTRY = 'https://registry.npmjs.org/@openaddresses%2Fdeploy/latest';
const TIMEOUT_MS = 2000;

function parseVersion(version: string): number[] {
    const [core] = version.replace(/^v/, '').split(/[-+]/);
    return core.split('.').map((part) => {
        const value = Math.trunc(Number(part));
        return Number.isNaN(value) ? 0 : value;
    });
}

export default class Version {
    static current(): string {
        const pkg = parseJson(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
        if (!isRecord(pkg) || typeof pkg.version !== 'string') {
            throw new Error('package.json is missing a version');
        }

        return pkg.version;
    }

    static async latest(fetchFn: typeof fetch = fetch): Promise<string | null> {
        try {
            const response = await fetchFn(REGISTRY, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(TIMEOUT_MS)
            });

            if (!response.ok) return null;

            const body: unknown = await response.json();
            return isRecord(body) && typeof body.version === 'string' ? body.version : null;
        } catch {
            return null;
        }
    }

    static isNewer(candidate: string, current: string): boolean {
        const a = parseVersion(candidate);
        const b = parseVersion(current);

        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const diff = (a[i] ?? 0) - (b[i] ?? 0);
            if (diff !== 0) return diff > 0;
        }

        return false;
    }

    static enabled(env: NodeJS.ProcessEnv = process.env): boolean {
        return !env.DEPLOY_NO_UPDATE_CHECK && !env.CI;
    }

    static async check(options: { env?: NodeJS.ProcessEnv; fetchFn?: typeof fetch; log?: (_msg: string) => void } = {}): Promise<string | null> {
        if (!Version.enabled(options.env)) return null;

        const current = Version.current();
        const latest = await Version.latest(options.fetchFn);

        if (!latest || !Version.isNewer(latest, current)) return null;

        const log = options.log ?? ((msg: string): void => {
            console.error(msg);
        });
        log(`\nA new version of deploy is available: ${current} -> ${latest}`);
        log('Run: npm install -g @openaddresses/deploy\n');

        return latest;
    }
}
