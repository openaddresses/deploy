<h1 align="center">Machine-ECS</h1>

---

<p align="center">Cloudformation to create and manage underlying ECS Cluster Instances</p>

## Install

If you don't have yarn installed - follow the instructions [here](https://yarnpkg.com/en/)

```
yarn install
```

### Create Cluster

Ensure the following variables are set:

```
AWS_DEFAULT_REGION="us-east-1"
AWS_ACCESS_KEY_ID
AWS_ACCOUNT_ID
AWS_SECRET_ACCESS_KEY
```

```
$(yarn bin)/cfn-config create <STACK NAME> cloudformation/machine-ecs.template -c cfn-config-active-${AWS_ACCOUNT_ID}-${AWS_DEFAULT_REGION} -r ${AWS_DEFAULT_REGION}
```


