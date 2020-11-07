# CHANGELOG

## Emoji Cheatsheet
- :pencil2: doc updates
- :bug: when fixing a bug
- :rocket: when making general improvements
- :white_check_mark: when adding tests
- :arrow_up: when upgrading dependencies
- :tada: when adding new features

## Version History

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

