import type { DeployArgv } from './types.js';

const BOOLEAN_FLAGS = [
    'help', 'version', 'debug', 'force', 'drift', 'reuse-parameters', 'skip-artifacts',
    'all', 'output', 'outputs', 'parameter', 'parameters'
] as const;

const STRING_FLAGS = [
    'profile', 'region', 'role', 'template', 'name', 'cluster', 'task',
    'command', 'container', 'service', 'account'
] as const;

export function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJson(raw: string): unknown {
    const parsed: unknown = JSON.parse(raw);
    return parsed;
}

export function errorCode(error: unknown): string | undefined {
    if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
        return error.code;
    }

    return undefined;
}

export function toArgv(values: Record<string, string | boolean | undefined>, positionals: string[] = []): DeployArgv {
    const argv: DeployArgv = { _: positionals };

    for (const key of BOOLEAN_FLAGS) {
        const value = values[key];
        if (value !== undefined) {
            argv[key] = value !== false;
        }
    }

    for (const key of STRING_FLAGS) {
        const value = values[key];
        if (typeof value === 'string') {
            argv[key] = value;
        }
    }

    return argv;
}
