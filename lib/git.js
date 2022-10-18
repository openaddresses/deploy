import path from 'path';
import cp from 'child_process';

/**
 * @class
 */
export default class Git {
    /**
     * Return top level dir of a git repo
     * @return {string}
     */
    static root() {
        const git = cp.spawnSync('git', [
            'rev-parse', '--show-toplevel'
        ]);

        if (!git.stdout) return (new Error('Is this a git repo? Could not determine Git Root Directory'));
        return String(git.stdout).replace(/\n/g, '');
    }

    /**
     * Get the name of the current GitRepo
     * @return {string}
     */
    static repo() {
        return path.parse(this.root()).name;
    }

    /**
     * Get the name of the current git user
     * @return {string}
     */
    static user() {
        const git = cp.spawnSync('git', [
            'config', 'user.name'
        ]);

        if (!git.stdout) return (new Error('Is this a git repo? Could not determine GitSha'));
        return String(git.stdout).replace(/\n/g, '');
    }

    /**
     * Get the name of the upstream git owner
     * @return {string}
     */
    static owner() {
        const git = cp.spawnSync('git', [
            'config', '--get', 'remote.origin.url'
        ]);

        if (!String(git.stdout)) return false;

        const owner = String(git.stdout).replace(/\n/g, '');

        if (owner.includes('git@github.com')) {
            return owner
                .replace(/.*git@github.com:/, '')
                .replace(/\/.*/, '');
        } else if (owner.includes('https://github.com')) {
            const giturl = new URL(owner);

            return giturl.pathname
                .replace('.git', '')
                .slice(1)
                .replace(/\/.*/, '');
        } else {
            throw new Error('only origins of format: git@github.com or https://github.com are supported');
        }
    }

    /**
     * Get the current GitSha
     */
    static sha() {
        const git = cp.spawnSync('git', [
            '--git-dir', path.resolve(this.root(), '.git'),
            'rev-parse', 'HEAD'
        ]);

        if (!git.stdout) return (new Error('Is this a git repo? Could not determine GitSha'));
        return String(git.stdout).replace(/\n/g, '');

    }

    /**
     * Determine if there are uncommitted changes in the repo
     */
    static uncommitted() {
        const git = cp.spawnSync('git', [
            '--git-dir', path.resolve(this.root(), '.git'),
            'status', '-s'
        ]);

        return !!String(git.stdout);
    }
}
