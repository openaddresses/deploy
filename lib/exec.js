import inquirer from 'inquirer';
import { CloudFormationClient, ListStacksCommand } from '@aws-sdk/client-cloudformation';
import {
    ECSClient,
    ListClustersCommand,
    ListServicesCommand,
    DescribeServicesCommand,
    DescribeTasksCommand,
    ListTasksCommand,
    ExecuteCommandCommand
} from '@aws-sdk/client-ecs';
import minimist from 'minimist';

/**
 * @class
 */
export default class Exec {
    static short = 'SSH into a fargate container';

    /**
     * Print help documentation to the screen
     */
    static help() {
        console.log();
        console.log('Usage: deploy exec');
        console.log();
        console.log('Run a command on a FARGATE service');
        console.log();
        console.log('[options]:');
        console.log('    --region  <region>      Override default region to perform operations in');
        console.log('    --cluster <cluster>     Set cluster to perform operation in');
        console.log('    --task <task>           Set TaskId to perform operation in');
        console.log('    --command <command>     Set command to run - defaults to /bin/bash');
        console.log();
    }

    /**
     * List current stacks deployed to a given profile
     *
     * @param {Context} context
     * @param {Object} argv
     */
    static async main(context, argv) {
        argv = minimist(argv, {
            string: ['region', 'cluster', 'task', 'command']
        });

        if (!argv) {
            argv.region = context.region;
        }

        const ecs = new ECSClient({
            credentials: context.aws,
            region: context.region
        });

        if (!argv.cluster) {
            const res = await ecs.send(new ListClustersCommand({}));

            Object.assign(argv, await inquirer.prompt({
                type: 'list',
                name: 'cluster',
                message: 'ECS Cluster',
                choices: res.clusterArns.map((cluster) => {
                    return cluster.split('/').pop()
                }).sort()
            }));
        }

        if (!argv.task) {
            const res = await ecs.send(new ListServicesCommand({
                cluster: argv.cluster
            }));

            Object.assign(argv, await inquirer.prompt({
                type: 'list',
                name: 'service',
                message: 'ECS Service',
                choices: res.serviceArns.map((service) => {
                    return service.split('/').pop()
                }).sort()
            }));

            const service = await ecs.send(new DescribeServicesCommand({
                cluster: argv.cluster,
                services: [ argv.service ]
            }))

            if (!service.services[0].enableExecuteCommand) {
                throw new Error('Service does not have enableExecuteCommand set to true - exec is disabled');
            }

            const tasks = await ecs.send(new ListTasksCommand({
                cluster: argv.cluster,
                serviceName: argv.service
            }));

            Object.assign(argv, await inquirer.prompt({
                type: 'list',
                name: 'task',
                message: 'ECS TASK',
                choices: tasks.taskArns.map((task) => {
                    return task.split('/').pop()
                }).sort()
            }));
        }

        if (!argv.container) {
            const tasks = await ecs.send(new DescribeTasksCommand({
                cluster: argv.cluster,
                tasks: [ argv.task ]
            }));

            Object.assign(argv, await inquirer.prompt({
                type: 'list',
                name: 'container',
                message: 'ECS Container',
                choices: tasks.tasks[0].containers.map((container) => {
                    return container.name
                }).sort()
            }));
        }

        console.log(`aws ecs execute-command --cluster ${argv.cluster} --task ${argv.task} --container ${argv.container} --command ${argv.command || '/bin/bash'} --interactive`)

        /** TODO Eventually support executing directly
        const exec = await ecs.send(new ExecuteCommandCommand({
            interactive: true,
            cluster: argv.cluster,
            task: argv.task,
            container: argv.container,
            command: argv.command || '/bin/bash'
        }));

        */ 
    }
}
