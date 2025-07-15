<h1 align="center">Deploy</h1>

<p align="center">OpenAddresses Deploy Tools for Cloudformation</p>

## Brief

- Store and manage AWS credentials locally for one or more AWS accounts
- Create, Update, & Delete CF based stacks from the terminal

## Install

Run the following

```sh
npm install -g @openaddresses/deploy
```

This will make the `deploy` command available globally

### Auth Setup

Before you can make changes to any of the underlying infrastructure you must first authenticate the deploy cli

To do so run:

```sh
deploy init
```

and follow the prompts for your credentials.

Note the `profile name` prompted for should ideally match the profile name as set in your AWS credentials
file located at `~/.aws/credentials` If the profile name is found in your AWS credentials file, the
credentials from the file will be linked. If it does not exist, you will be prompted for a set of credentials

Once finished run

```sh
deploy
```

to see a full list of options

Note: The credentials file can be found in the `~/.deployrc.json` file

# Global Config `~/.deployrc.json`

## Required Tags

If an account uses tags for billing, the following can be used in the `~/.deployrc.json` file to ensure that
tags are attached to all stacks deployed to that profile

| Key               | Notes |
| ----------------- | ----- |
| `region`          | Default AWS Account Region |

## Optional Tags

| Key               | Notes |
| ----------------- | ----- |
| `tags`            | Cloudformation Tags to apply to stack |
| `github`          | Github API token for updating deployment status |

### Tags

Tags can be added to all resources in a stack that is deployed. The tags
array can contain either Keys as strings, or Key/Value objects.

Key as strings will be automatically populated for each resource of the CF template
and the Value added as a Parameter of the stack

Key/Value objects will be automatically populated for each resource except
that no Parameter will be added - the Value will be used directly

```JSON
{
    "<profile_name>": {
        "region": "<region>",
        "tags": ["Project", {
            "Key": "Owner",
            "Value": "ingalls"
        }, "Client", "<another tag>"]
    }
}
```

# Project Config `./deploy`

## Required Tags

If you run `deploy init` for a single AWS profile, all resources created with the tool will automatically
be deployed to this "default" account.

If multiple AWS profiles are created via `batch init`, then you will either need to use
the `--profile <name>` flag when interacting with the API, or to specify the profile in your `.deploy` file

The `./deploy` file is created in the root directory of the git repo and follows the following format:

```JSON
{
    "profile": "name of AWS Account profile",
}
```

## Artifacts

### Watching for Docker Artifacts

By default, if a `Dockerfile` is found in the project root, the ECR will be queried before deploy to ensure
the image has been built. IE: a git repo named `my-project` would look for an image called `my-project:<Git Sha>`.

If you are building multiple docker images, or want to disable this feature, the following options are available
via the `.deploy` file.

**Disable ECR Check**

```JSON
{
    "artifacts": {
        "docker": false
    }
}
```
**Custom Pre/Postfix**

```JSON
{
    "artifacts": {
        "docker": "custom-ecr:{{gitsha}}"
    }
}
```

```JSON
{
    "artifacts": {
        "docker": "{{project}}:prefix-{{gitsha}}-postfix"
    }
}
```

**Multiple Images**

```JSON
{
    "artifacts": {
        "docker": [
            "{{project}}:backend-{{gitsha}}",
            "{{project}}:frontend-{{gitsha}}"
        ]
    }
}
```

### Watching for Docker Artifacts

Lambda uploads are not watched for by default. Set artifact listeners via your `.deploy` file
using the examples below to ensure that they are present on s3 before deploy.

**Disable Lambda Check** (Default)

```JSON
{
    "artifacts": {
        "lambda": false
    }
}
```

**Single Lambda**

```JSON
{
    "artifacts": {
        "lambda": "<bucket>/{{gitsha}}.zip"
    }
}
```

**Multiple Lambdas**

```JSON
{
    "artifacts": {
        "lambda": [
            "<bucket>/deploy-lambda/{{gitsha}}.zip",
            "<bucket:>/{{project}}-{{gitsha}}.zip"
        ]
    }
}
```

### Tags

Tags can be added to all resources in a stack that is deployed. The tags
array can contain either Keys as strings, or Key/Value objects.

The format to adding project specific tags is identical to profile tags
as defined in the `~/.deployrc.json` file. See this documentation
for complete information on tag formatting.

```JSON
{
    "tags": ["Project", {
        "Key": "Owner",
        "Value": "ingalls"
    }, "Client", "<another tag>"]
}
```

### GitHub Status Check Polling

By default, when GitHub integration is enabled, the deploy tool will poll GitHub status checks before proceeding with deployments. This ensures that all CI checks pass before deployment begins.

The polling behavior can be configured in your `.deploy` file:

```JSON
{
    "github": {
        "polling": {
            "timeout": 1800000,
            "interval": 30000
        }
    }
}
```

**Configuration Options:**

- `timeout`: Maximum time to wait for status checks in milliseconds (1 minute to 1 hour, default: 30 minutes)
- `interval`: Time between status check polls in milliseconds (5 seconds to 5 minutes, default: 30 seconds)

If any status checks fail, the deployment will be aborted with an error message indicating which checks failed.
