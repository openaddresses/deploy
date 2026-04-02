import cp from 'node:child_process';
import path from 'node:path';

export default class Git {
    static root(): string {
        const git = cp.spawnSync('git', ['rev-parse', '--show-toplevel']);
        const stdout = String(git.stdout ?? '').trim();

        if (!stdout) {
            throw new Error('Is this a git repo? Could not determine Git root directory');
        }

        return stdout;
    }

    static repo(): string {
        return path.parse(this.root()).name;
    }

    static user(): string {
        const git = cp.spawnSync('git', ['config', 'user.name']);
        const stdout = String(git.stdout ?? '').trim();

        if (!stdout) {
            throw new Error('Is this a git repo? Could not determine git user');
        }

        return stdout;
    }

    static owner(): string | false {
        const git = cp.spawnSync('git', ['config', '--get', 'remote.origin.url']);
        const stdout = String(git.stdout ?? '').trim();

        if (!stdout) {
            return false;
        }

        if (stdout.includes('git@github.com')) {
            return stdout
                .replace(/.*git@github.com:/, '')
                .replace(/\/.*/, '');
        }

        if (/https:\/\/.*github.com/.test(stdout)) {
            const remoteUrl = new URL(stdout);
            return remoteUrl.pathname
                .replace('.git', '')
                .slice(1)
                .replace(/\/.*/, '');
        }

        throw new Error('only origins of format: git@github.com or https://github.com are supported');
    }

    static sha(): string {
        const git = cp.spawnSync('git', ['--git-dir', path.resolve(this.root(), '.git'), 'rev-parse', 'HEAD']);
        const stdout = String(git.stdout ?? '').trim();

        if (!stdout) {
            throw new Error('Is this a git repo? Could not determine GitSha');
        }

        return stdout;
    }

    static uncommitted(): boolean {
        const git = cp.spawnSync('git', ['--git-dir', path.resolve(this.root(), '.git'), 'status', '-s']);
        return Boolean(String(git.stdout ?? '').trim());
    }

    static pushed(): boolean {
        const git = cp.spawnSync('git', ['--git-dir', path.resolve(this.root(), '.git'), 'status']);
        return !/Your branch is ahead of/.test(String(git.stdout ?? ''));
    }
}
