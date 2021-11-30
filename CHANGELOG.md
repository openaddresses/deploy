# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

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

