<h1 align="center">Deploy</h1>

<p align="center">OpenAddresses Deploy Tools for Cloudformation</p>

## Brief

- Store and manage AWS creds locally for one or more AWS accounts
- Create, Update, & Delete CF based stacks from the terminal

## Install

If you don't have yarn installed - follow the instructions [here](https://yarnpkg.com/en/)

```
yarn install

yarn link
```

This will make the `deploy` command avaliable globally

### Auth Setup

Before you can make changes to any of the underlying infrastructure you must first authenticate the deploy cli

To do so run:

```
 init
```

and follow the prompts for your credentials.

Once finished run

```
deploy
```

to see a full list of options

### Project Management

If you run `deploy init` for a single AWS profile, all resources created with the tool will automatically
be deployed to this "default" account.

If multiple AWS profiles are created via `batch init`, then you will either need to use
the `--profile <name>` flag when interacting with the API, or to specfiy the profile in your `.deploy` file

The `./deploy` file is created in the root directory of the git repo and follows the following format:

```JSON
{
    "profile": "name of AWS Account profile",
    "tags": [{
        "Key": "Optional Tags",
        "Value": "That should be applied to Resources (Useful for billing)"
    }]
}
```

### Watching for Artifacts

By default, if a `Dockerfile` is found in the project root, the ECR will be queried before deploy to ensure
the image has been built. IE: a git repo named `my-project` would look for an image called `my-project:<Git Sha>`.

If you are building multiple docker images, or want to disable this feature, the following options are avaliable
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
