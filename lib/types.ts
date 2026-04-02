import type CFN from '@openaddresses/cfn-config';

export interface AwsCredentials {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
    expiration?: Date;
}

export interface DeployTag {
    Key: string;
    Value: string;
}

export type ConfigTag = string | DeployTag;

export interface DeployProfile {
    region?: string;
    github?: string;
    tags?: ConfigTag[];
}

export interface DotDeployArtifacts {
    docker?: string | string[] | false;
    s3?: string | string[] | false;
}

export interface DotDeployConfig {
    profile?: string;
    name?: string;
    region?: string;
    artifacts?: DotDeployArtifacts;
    tags?: ConfigTag[];
}

export interface GitHubPollingConfig {
    timeout: number;
    interval: number;
}

export interface DeployContext {
    user: string;
    owner: string | false;
    repo: string;
    sha: string;
    deployment: number | false;
    name: string;
    stack: string;
    subname: string | null;
    template: string | null;
    profile: string;
    dotdeploy: DotDeployConfig;
    profiles: Record<string, DeployProfile>;
    tags: ConfigTag[];
    region: string;
    github: string | false;
    githubPolling: GitHubPollingConfig;
    force: boolean;
    aws: AwsCredentials;
    cfn: CFN;
    _accountId?: string;
    accountId(): Promise<string>;
}

export interface DeployArgv {
    _: string[];
    help?: boolean;
    version?: boolean;
    debug?: boolean;
    force?: boolean;
    profile?: string;
    region?: string;
    template?: string | false;
    name?: string;
    all?: boolean;
    cluster?: string;
    task?: string;
    command?: string;
    container?: string;
    service?: string;
    output?: boolean;
    outputs?: boolean;
    parameter?: boolean;
    parameters?: boolean;
}

export interface CommandModule {
    short: string;
    help(): void;
    main?: (..._args: any[]) => Promise<void> | void;
    bucket?: (_context: DeployContext) => Promise<void>;
}
