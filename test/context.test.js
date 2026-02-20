import { describe, it, expect, vi, afterEach } from "vitest";
import fs from "fs";
import Credentials from "../lib/context.js";
import Git from "../lib/git.js";

vi.mock("../lib/git.js", () => ({
    default: {
        user: vi.fn(() => "testuser"),
        owner: vi.fn(() => "testowner"),
        repo: vi.fn(() => "testrepo"),
        sha: vi.fn(() => "abc123"),
        root: vi.fn(() => "/tmp/fake-root"),
    },
}));

vi.mock("@aws-sdk/credential-providers", () => ({
    fromIni: vi.fn(() => async () => ({
        accessKeyId: "NOTAREALACCESSKEY",
        secretAccessKey: "l33t/10xeNg1n33r/EXAMPLEKEY",
    })),
}));

vi.mock("@aws-sdk/client-sts", () => ({
    // Use a plain arrow function for `send` so mock-clearing can't affect it.
    STSClient: vi.fn(() => ({
        send: () => Promise.resolve({ Account: "123456789012" }),
    })),
    GetCallerIdentityCommand: vi.fn(),
}));

vi.mock("@openaddresses/cfn-config", () => ({
    default: vi.fn(() => ({})),
}));

/**
 * Build a minimal argv object. Sets template=false to skip cloudformation
 * template discovery, which requires the local filesystem.
 */
function makeArgv(overrides = {}) {
    return {
        _: ["node", "deploy", "list"],
        template: false,
        force: false,
        ...overrides,
    };
}

/**
 * Spy on fs.readFileSync so that reads of ~/.deployrc.json return the given
 * content while all other reads (schema files, etc.) pass through to the
 * real implementation.
 */
function mockRcFile(content) {
    const original = fs.readFileSync.bind(fs);
    vi.spyOn(fs, "readFileSync").mockImplementation((filePath, ...args) => {
        if (String(filePath).endsWith(".deployrc.json")) {
            return JSON.stringify(content);
        }
        return original(filePath, ...args);
    });
}

describe("Credentials.generate", () => {
    afterEach(() => {
        // Restore fs.readFileSync and Credentials.dot_deploy spies between tests.
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Region precedence
    // Priority (highest → lowest): --region CLI > dotdeploy (.deploy) > profile rc (~/.deployrc.json) > default
    // -----------------------------------------------------------------------

    describe("region precedence", () => {
        it("defaults to us-east-1 when nothing is configured", async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe("us-east-1");
        });

        it("uses the profile region from ~/.deployrc.json when --region is not given", async () => {
            mockRcFile({ default: { region: "eu-west-1" } });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe("eu-west-1");
        });

        it("uses the dotdeploy region when no --region", async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue({
                region: "us-west-2",
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe("us-west-2");
        });

        it("dotdeploy region takes precedence over profile region from ~/.deployrc.json", async () => {
            // The per-repo .deploy file overrides the global ~/.deployrc.json profile.
            mockRcFile({ default: { region: "eu-central-1" } });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue({
                region: "us-west-2",
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.region).toBe("us-west-2");
        });

        it("--region overrides profile region from ~/.deployrc.json", async () => {
            mockRcFile({ default: { region: "eu-west-1" } });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            const creds = await Credentials.generate(
                makeArgv({ region: "ap-southeast-1" }),
            );

            expect(creds.region).toBe("ap-southeast-1");
        });

        it("--region overrides dotdeploy region", async () => {
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue({
                region: "us-west-2",
            });

            const creds = await Credentials.generate(
                makeArgv({ region: "ca-central-1" }),
            );

            expect(creds.region).toBe("ca-central-1");
        });
    });

    describe("profile selection", () => {
        it("auto-selects the only profile when one exists in ~/.deployrc.json", async () => {
            mockRcFile({ myprofile: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            const creds = await Credentials.generate(makeArgv());

            expect(creds.profile).toBe("myprofile");
        });

        it("uses --profile to select one of multiple profiles", async () => {
            mockRcFile({ staging: {}, production: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            const creds = await Credentials.generate(
                makeArgv({ profile: "staging" }),
            );

            expect(creds.profile).toBe("staging");
        });

        it("uses the profile specified in the dotdeploy file", async () => {
            mockRcFile({ staging: {}, production: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue({
                profile: "production",
            });

            const creds = await Credentials.generate(makeArgv());

            expect(creds.profile).toBe("production");
        });

        it("throws when multiple profiles exist and --profile is not specified", async () => {
            mockRcFile({ staging: {}, production: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow(
                "Multiple deploy profiles found",
            );
        });

        it("each profile carries its own region independently", async () => {
            mockRcFile({
                us: { region: "us-east-1" },
                eu: { region: "eu-west-1" },
            });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            const creds = await Credentials.generate(
                makeArgv({ profile: "eu" }),
            );

            expect(creds.region).toBe("eu-west-1");
        });
    });

    describe("git validation", () => {
        it("throws when not inside a git repository", async () => {
            Git.repo.mockReturnValueOnce(null);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow(
                "No Git Repo detected",
            );
        });

        it("throws when the current git sha cannot be determined", async () => {
            Git.sha.mockReturnValueOnce(null);
            mockRcFile({ default: {} });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow(
                "Could not determine git sha",
            );
        });
    });

    describe("rc file schema validation", () => {
        it("throws when ~/.deployrc.json has an unrecognised property", async () => {
            // additionalProperties: false means unknown keys inside a profile
            // object are rejected by AJV.
            mockRcFile({ default: { unknownKey: "value" } });
            vi.spyOn(Credentials, "dot_deploy").mockReturnValue(false);

            await expect(Credentials.generate(makeArgv())).rejects.toThrow(
                "~/.deployrc.json does not conform to schema",
            );
        });
    });
});
