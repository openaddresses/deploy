<h1 align="center">Machine-ECS</h1>

<p align="center">Deploy Tools for Cloudformation</p>

## Brief

- Store and manage OpenAddresses AWS creds locally
- Create, Update, & Delete CF based stacks from the terminal
- CF templates to manage underlying ECS Infrastructure

## Install

If you don't have yarn installed - follow the instructions [here](https://yarnpkg.com/en/)

```
yarn install

yarn link
```

### Auth Setup

Before you can make changes to any of the underlying infrastructure you must first authenticate the oa cli

To do so run:

```
oa init
```

and follow the prompts for your credentials.

Once finished run

```
oa
```

to see a full list of options
