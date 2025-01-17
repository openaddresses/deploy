# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

### v9.6.0

- :bug: Fix finalizing GH Deployment

### v9.5.0

- :bug: Fix Github Deployment

### v9.4.1

- :bug: Don't prefix deploy template with body

### v9.4.0

- :bug: Use NextToken in list API if there are more stacks than a single List Stacks API call can show

### v9.3.0

- :rocket: Change `StackName` var to `RootStackName` and `FullStackName`

### v9.2.0

- :tada: Increase number of template options and rename lambda => s3

### v9.1.0

- :tada: Add support for building `aws ecs execute-command` interactively

### v9.0.0

- :rocket: Use `AWS_REGION` in env output to mirror all modern AWS SDKs/CLIs

### v8.4.0

- :rocket: Human readable error when outside of git repository

### v8.3.1

- :rocket: Add support on update

### v8.3.0

- :rocket: Support for Descriptions being parsed and posted from Template

### v8.2.0

- :rocket: Internal Support for Descriptions in CloudFormation Templates

### v8.1.1

- :bug: Fix name resolution when using sub-template

### v8.1.0

- :arrow_up: Update Core Dependencies
- :rocket: Pull and populate existing tags when updating a stack

### v8.0.2

- :bug: Fix path resolution in `--template` parameter

### v8.0.1

- :rocket: Update to CFN-Config@7.1 to fix S3 Body parsing

### v8.0.0

- :rocket: Update to CFN-Config@7

### v7.8.0

- :arrow_up: Remove now unnecessary node-fetch
- :arrow_up: Remove unused octokit dep

### v7.7.0
- :arrow_up: Remove top-level use of aws-sdk
- :tada: Add support for GovCloud S3 Config Buckets

### v7.6.0

- :bug: Include region in STS call to work in GovCloud
- :arrow_up: Update base deps

### v7.5.0

- :tada: Allow specifying default region at repo level
- :tada: Don't expect a `~/.deployrc.json` file to exist

### v7.4.0

- :bug: Support reading stack parameters from stacks created via YAML Cloudformation templates

### v7.3.3

- :bug: DotDeploy file should allow `name` property for overriding repo name

### v7.3.2

- :arrow_up: Update base deps

### v7.3.1

- :rocket: Move help text to it's own file

### v7.3.0

- :tada: Check for unpushed changes before deploying

### v7.2.0

- :tada: Check for uncommitted changes before deploying

### v7.1.1

- :bug: Fix bug where `info` wouldn't receive AWS credentials

### v7.1.0

- :rocket: Add `cancel` subcommand
- :pencil2: Remove a bunch of README comments referring to retired auth scheme
- :rocket: Move help text to individual files

### v7.0.1

- :arrow_up: Update base deps

### v7.0.0

- :tada: Add support for Global CF tags
- :rocket: Remove `accountId` from deploy file

### v6.1.1

- :rocket: Setup Automated Deploys

### v6.1.0

- :bug: Use `cfn-config.Template.read` instead of `cloudfriend.build` for compiling template

### v6.0.0

- :rocket: `CFN-Config@6` now requires all cloudformation JS inputs to be Common Modules

### v5.3.1

- :arrow_up: Update base deps

### v5.3.0

- :rocket: Add new tag style support

### v5.2.2

- :arrow_up: Update base deps

### v5.2.1

- :arrow_up: Update base deps

### v5.2.0

- :tada: Add `--all` flag to list all stacks in all regions

### v5.1.2

- :bug: Fix bug in ECR artifacts check

### v5.1.1

- :bug: Fix accountId gen in env subcommand

### v5.1.0

- :rocket: Remove need to have hardcoded AccountID and instead look it up dynamically

### v5.0.1

- :pencil2: Add better error messages

### v5.0.0

- :rocket: Update module to ES6 Imports

### v4.3.3

- :arrow_up: Update base deps

### v4.3.2

- :bug: `--region` param should override json config

### v4.3.1

- :arrow_up: Update base deps (Notably: `@mapbox/cloudfriend@5.1.0`

### v4.3.0

- :rocket: Allow `deploy info ml-enabler-prod` in addition to the current `deploy info prod`

### v4.2.0

- :tada: Support HTTPS origins for GH org parsing

### v4.1.0

- :tada: Ensure config bucket is present and offer to create it if not

### v4.0.1

- :arrow_up: Update core deps

### v4.0.0

- :rocket: Update to `@openaddresses/cfn-config` which uses a Promise based API
- :pencil2: Doing a major version bump as this is a large change with potentially unseen repurcusions

### v3.4.2

- :bug: `colors@1.4.2` is considered harmful as a loop was intentionally introduced by the developer
- :arrow_up: Update cfn-config to pin colors library

### v3.4.1

- :bug: Fix ESLint bug

### v3.4.0

- :tada: Output `AWS_ACCOUNT_ID` in `env` command

### v3.3.0

- :rocket: Use `@oa` namespace

### v3.2.0

- :arrow_up: Update all deps. Notable: `eslint@8`
- :white_check_mark: Add GH actions for running lint enforcement

### v3.1.1

- :bug: Fix bug where non-existant callback was called

### v3.1.0

- :bug: Fix a bug in marking a Github Environment as deployed
- :rocket: Convert a bunch of internals to promises for improved readability

### v3.0.0

- :rocket: Add strong schema validation to DeployRC
- :rocket: Add strong schema validation to DotDeploy
- :tada: Add Key/Value support for tags in DepoyRC
- :tada: Add Key & Key/Value support for tags in DotDeploy
- :arrow_up: General Dep Update

### v2.8.0

- :tada: Add tagger support to JSON subcommand

### v2.7.1

- :arrow_up: Update deps

- :tada: Add support for automatically resolving `{{resolve:}}` blocks in the Outputs section of a CF template
         when using `deploy info`.

### v2.6.0

- :arrow_up: Update base deps
- :tada: Add support for reading `.deploy` file when in a sub directory of the repo

### v2.5.2

- :arrow_up: Update base deps

### v2.5.1

- :bug: Fix GH Deployment integration

### v2.5.0

- :tada: Add support for github deployments API
- :arrow_up: generate deps update

### v2.4.0

- :rocket: Use aws credentials file if profile is present
- :tada: Conditionally prompt for credentials in `init` mode only if credentials are not present in AWS file

### v2.3.0

- :tada: Add `json` subcommand for outputting JSONified CF templates

### v2.2.0

- :arrow_up: Update to `cfn-config@3.0.1` to fix deploy bug

### v2.1.1

- :arrow_up: Update to latest cfn-config & cloudfriend

### v2.1.0

- :tada: `.deploy` files can now specify a `name` property to override the repo name
- :arrow_up: Update all deps

### v2.0.2

- :arrow_up: Update `aws-sdk`

### v2.0.1

- :arrow_up: General dep updates

### v2.0.0

- :arrow_up: general dep updates
- :tada: Add support for propagateatlaunch tagging
- :tada: Add support for overriding the default naming conventions for sub templates via `--name` argument

### v1.4.1

- :arrow_up: General dependency update

### v1.4.0

- :rocket: Refactor `lib/creds` for readability & future extensions
- :tada: Add ESLinting to the project

### v1.3.2

- :arrow_up: Update base deps

### v1.3.1

- :bug: Some modes shouldn't attempt to load a template

### v1.3.0

- :tada: Add support for the `--template` flag
- :rocket: Move a bunch of modules to individual classes

### v1.2.4

- :bug: Fix `--version` flag
- :bug: Add missing help mode for `deploy info --help`
- :pencil2: Fix and expand in code help documentation

### v1.2.3

- :arrow_up: Update core deps to latest versions

### v1.2.2

- :arrow_up: Update to latest `minimist` version in response to GH Security Advisory

### v1.2.1

- :bug: Avoid error during simultaneous deploys when the CF file is deleted by whichever deploy is finished first

### v1.2.0

- :tada: Add support for `--parameters` table mode

### v1.1.0

- :tada: Add table support for stack Outputs
- :rocket: Refactor `info` subcommand into mode

### v1.0.0

- :rocket: Refactor artifacts to be more generic and support lambdas

