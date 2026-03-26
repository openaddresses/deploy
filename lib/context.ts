import fs from 'node:fs';
import path from 'node:path';
import AjvModule from 'ajv';
import CFN from '@openaddresses/cfn-config';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-providers';
import Git from './git.js';
import type { AwsCredentials, DeployArgv, ConfigTag, DeployProfile, DotDeployConfig, GitHubPollingConfig, DeployTag } from './types.js';

const AjvConstructor = ((AjvModule as unknown as { default?: unknown }).default ?? AjvModule) as new (options?: object) => {
    compile: (schema: object) => {
        (data: unknown): boolean;
        errors?: unknown;
    };
};

const ajv = new AjvConstructor({
    allErrors: true
});

const PROFILE_KEYS = ['region', 'github'] as const;

export default class Credentials {
    user = '';
    owner: string | false = false;
    repo = '';
    sha = '';
    deployment: number | false = false;
    name = '';
    stack = '';
    subname: string | null = '';
    template: string | null = null;
    profile = '';
    dotdeploy: DotDeployConfig = {};
    profiles: Record<string, DeployProfile> = {};
    tags: ConfigTag[] = [];
    region = 'us-east-1';
    github: string | false = false;
    githubPolling: GitHubPollingConfig = {
        timeout: 30 * 60 * 1000,
        interval: 30 * 1000
    };
    force = false;
    aws!: AwsCredentials;
    cfn!: CFN;
    _accountId?: string;

    static async generate(argv: DeployArgv): Promise<Credentials> {
        const creds = new Credentials();
        creds.user = Git.user();
        creds.owner = Git.owner();
        creds.repo = Git.repo();
        creds.sha = Git.sha();

        if (!creds.repo) {
            throw new Error('No Git Repo detected! Are you in the correct directory? Or did you download a static non-git copy of the repo?');
        }

        if (!creds.sha) {
            throw new Error('Could not determine git sha');
        }

        creds.stack = String(argv._[3] ?? '').replace(new RegExp(`^${creds.repo}-`), '');
        creds.force = argv.force ?? false;
        creds.dotdeploy = Credentials.dot_deploy() || {};

        const readcreds = Credentials.readProfiles();

        Object.keys(readcreds).forEach((key) => {
            if (readcreds[key] !== undefined) {
                creds.profiles[key] = readcreds[key] as DeployProfile;
            }
        });

        if (typeof argv.template === 'string') {
            creds.subname = `${path.parse(argv.template).name.replace(/\.template/, '')}-`;
            creds.template = argv.template;
        } else if (argv.template === false) {
            creds.subname = null;
            creds.template = null;
        } else {
            creds.subname = '';
            creds.template = Credentials.findTemplatePath(creds.repo);
        }

        if (creds.dotdeploy.name) {
            creds.repo = creds.dotdeploy.name;
        }

        if (argv.profile) {
            creds.profile = argv.profile;
        } else if (creds.dotdeploy.profile) {
            creds.profile = creds.dotdeploy.profile;
        } else if (Object.keys(creds.profiles).length > 1) {
            throw new Error('Multiple deploy profiles found. Deploy with --profile or set a .deploy file');
        } else {
            creds.profile = Object.keys(creds.profiles)[0] ?? 'default';
        }

        if (!creds.profiles[creds.profile]) {
            creds.profiles[creds.profile] = {};
        }

        PROFILE_KEYS.forEach((key) => {
            const value = creds.profiles[creds.profile][key];
            if (value !== undefined) {
                creds[key] = value;
            }
        });

        if (argv.region) {
            creds.region = argv.region;
        } else if (creds.dotdeploy.region) {
            creds.region = creds.dotdeploy.region;
        }

        if (argv.name) {
            creds.name = argv.name.replace(new RegExp(`^${creds.repo}-`), '');
        } else {
            creds.name = `${creds.subname ?? ''}${creds.stack}`;
        }

        const profileConfig = readcreds[creds.profile] ?? {};
        if (profileConfig.tags) {
            creds.tags = creds.tags.concat(profileConfig.tags);
        }

        if (creds.dotdeploy.tags) {
            creds.tags = creds.tags.concat(creds.dotdeploy.tags);
        }

        try {
            creds.aws = await (await fromIni({
                profile: creds.profile
            })()) as Credentials['aws'];
        } catch {
            throw new Error('creds not set: run deploy init');
        }

        const accountId = await creds.accountId();
        creds.cfn = new CFN({
            region: creds.region,
            credentials: creds.aws
        }, {
            tags: creds.tags.filter((t): t is DeployTag => typeof t !== 'string'),
            name: creds.repo,
            configBucket: `cfn-config-active-${accountId}-${creds.region}`,
            templateBucket: `cfn-config-templates-${accountId}-${creds.region}`
        });

        return creds;
    }

    static dot_deploy(): DotDeployConfig | false {
        const attempts = Array.from(new Set([
            path.resolve('./.deploy'),
            path.resolve(Git.root(), '.deploy')
        ]));

        const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL('../data/schema.json', import.meta.url), 'utf8')) as object);

        for (const attempt of attempts) {
            if (!fs.existsSync(attempt)) {
                continue;
            }

            let dotdeploy: DotDeployConfig;
            try {
                dotdeploy = JSON.parse(fs.readFileSync(attempt, 'utf8')) as DotDeployConfig;
            } catch (error) {
                if (error instanceof SyntaxError) {
                    throw new Error(`Invalid JSON in ${attempt} file`, { cause: error });
                }

                throw error;
            }

            if (!validate(dotdeploy)) {
                console.error(JSON.stringify(validate.errors, null, 4));
                throw new Error(`${attempt} does not conform to schema`);
            }

            return dotdeploy;
        }

        return false;
    }

    async accountId(): Promise<string> {
        if (this._accountId) {
            return this._accountId;
        }

        const sts = new STSClient({
            credentials: this.aws,
            region: this.region
        });

        const account = await sts.send(new GetCallerIdentityCommand({}));
        if (!account.Account) {
            throw new Error('Unable to determine AWS account ID');
        }

        this._accountId = account.Account;
        return this._accountId;
    }

    private static readProfiles(): Record<string, DeployProfile> {
        let readcreds: Record<string, DeployProfile>;
        try {
            const raw = fs.readFileSync(path.resolve(process.env.HOME ?? '', '.deployrc.json'), 'utf8');
            readcreds = JSON.parse(raw) as Record<string, DeployProfile>;
        } catch {
            readcreds = {};
        }

        const validate = ajv.compile(JSON.parse(fs.readFileSync(new URL('../data/rc_schema.json', import.meta.url), 'utf8')) as object);
        if (!validate(readcreds)) {
            console.error(JSON.stringify(validate.errors, null, 4));
            throw new Error('~/.deployrc.json does not conform to schema');
        }

        return readcreds;
    }

    private static findTemplatePath(repo: string): string {
        const baseName = `${repo}.template`;
        const cloudformationDir = path.resolve('./cloudformation/');
        for (const file of fs.readdirSync(cloudformationDir)) {
            if (!file.includes(baseName)) {
                continue;
            }

            const parsed = path.parse(file);
            if (parsed.name === baseName && (parsed.ext === '.js' || parsed.ext === '.json')) {
                return path.resolve(cloudformationDir, file);
            }
        }

        throw new Error(`Could not find CF Template in cloudformation/${repo}.template.js(on)`);
    }
}
