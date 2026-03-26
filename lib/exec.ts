import inquirer from 'inquirer';
import minimist from 'minimist';
import {
    DescribeServicesCommand,
    DescribeTasksCommand,
    ECSClient,
    ListClustersCommand,
    ListServicesCommand,
    ListTasksCommand
} from '@aws-sdk/client-ecs';
import type { DeployArgv, DeployContext } from './types.js';

export default class Exec {
    static short = 'SSH into a fargate container';

    static help(): void {
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

    static async main(context: DeployContext, argvInput: string[]): Promise<void> {
        const argv = minimist(argvInput, {
            string: ['region', 'cluster', 'task', 'command', 'container']
        }) as DeployArgv;

        if (!argv.region) {
            argv.region = context.region;
        }

        const ecs = new ECSClient({
            credentials: context.aws,
            region: argv.region
        });

        if (!argv.cluster) {
            const response = await ecs.send(new ListClustersCommand({}));
            const choices = (response.clusterArns ?? []).map((cluster) => cluster.split('/').pop() ?? cluster).sort();

            if (choices.length === 0) {
                throw new Error('No ECS clusters found');
            }

            const answer = await inquirer.prompt<{ cluster: string }>({
                type: 'list',
                name: 'cluster',
                message: 'ECS Cluster',
                choices
            });
            argv.cluster = answer.cluster;
        }

        if (!argv.task) {
            const servicesResponse = await ecs.send(new ListServicesCommand({
                cluster: argv.cluster
            }));
            const serviceChoices = (servicesResponse.serviceArns ?? []).map((service) => service.split('/').pop() ?? service).sort();

            if (serviceChoices.length === 0) {
                throw new Error(`No ECS services found for cluster ${argv.cluster}`);
            }

            const serviceAnswer = await inquirer.prompt<{ service: string }>({
                type: 'list',
                name: 'service',
                message: 'ECS Service',
                choices: serviceChoices
            });
            argv.service = serviceAnswer.service;

            const service = await ecs.send(new DescribeServicesCommand({
                cluster: argv.cluster,
                services: [argv.service]
            }));
            const selectedService = service.services?.[0];

            if (!selectedService?.enableExecuteCommand) {
                throw new Error('Service does not have enableExecuteCommand set to true - exec is disabled');
            }

            const tasks = await ecs.send(new ListTasksCommand({
                cluster: argv.cluster,
                serviceName: argv.service
            }));
            const taskChoices = (tasks.taskArns ?? []).map((task) => task.split('/').pop() ?? task).sort();

            if (taskChoices.length === 0) {
                throw new Error(`No ECS tasks found for service ${argv.service}`);
            }

            const taskAnswer = await inquirer.prompt<{ task: string }>({
                type: 'list',
                name: 'task',
                message: 'ECS Task',
                choices: taskChoices
            });
            argv.task = taskAnswer.task;
        }

        if (!argv.container) {
            const tasks = await ecs.send(new DescribeTasksCommand({
                cluster: argv.cluster,
                tasks: [argv.task ?? '']
            }));
            const containerChoices = (tasks.tasks?.[0]?.containers ?? []).map((container) => container.name ?? '').filter(Boolean).sort();

            if (containerChoices.length === 0) {
                throw new Error(`No containers found for task ${argv.task}`);
            }

            const containerAnswer = await inquirer.prompt<{ container: string }>({
                type: 'list',
                name: 'container',
                message: 'ECS Container',
                choices: containerChoices
            });
            argv.container = containerAnswer.container;
        }

        console.log(`aws ecs execute-command --cluster ${argv.cluster} --task ${argv.task} --container ${argv.container} --command ${argv.command || '/bin/bash'} --interactive`);
    }
}
