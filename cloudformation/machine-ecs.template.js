const cf = require('@mapbox/cloudfriend');

module.exports = {
    "AWSTemplateFormatVersion": "2010-09-09",
    "Description" : "Machine-ECS Template - Host For ECS Tasks",
    "Parameters" : {
        "ClusterName": {
            "Description" : "Name of your Amazon ECS Cluster",
            "Type" : "String",
            "ConstraintDescription" : "must be a valid Amazon ECS Cluster.",
            "Default" : "production"
        },
        "ClusterSize": {
            "Description": "How many ECS hosts do you want to initially deploy?",
            "Type": "Number",
            "Default": 1
        },
        "MaxClusterSize": {
            "Description": "Max ECS Hosts for Docker Tasks in Cluster",
            "Type": "Number",
            "Default": 10
        },
        "InstanceType" : {
            "Description" : "Container Instance type",
            "Type" : "String",
            "Default" : "m3.medium",
            "AllowedValues" : [ "m3.medium", "m3.large", "m3.xlarge" ],
            "ConstraintDescription" : "must be a valid EC2 instance type."
        }
    },
    "Resources" : {
        "ECSCluster": {
            "Type": "AWS::ECS::Cluster",
            "Properties": { "ClusterName": cf.join('', [ 'machine-ecs-', cf.ref('ClusterName') ]) }
        },
        "ECSScaleUpAlarm": {
            "Type" : "AWS::CloudWatch::Alarm",
            "Properties" : {
                "AlarmDescription" : "Scale Up when CPU placement limits are hit",
                "AlarmActions" : [ cf.ref('ECSScaleUpPolicy') ],
                "MetricName" : "CPUReservation",
                "Namespace" : "AWS/ECS",
                "Statistic" : "Average",
                "Period" : "60",
                "EvaluationPeriods" : "1",
                "Threshold" : "50",
                "ComparisonOperator" : "GreaterThanThreshold",
                "Dimensions" : [ { "Name" : "ECSAutoScalingGroup" , "Value": cf.ref('ECSAutoScalingGroup') } ]
            }
        },
        "ECSScaleUpPolicy": {
            "Type": "AWS::AutoScaling::ScalingPolicy",
            "Properties": {
                "AdjustmentType" : "ChangeInCapacity",
                "PolicyType" : "SimpleScaling", 
                "Cooldown" : "60",
                "AutoScalingGroupName": cf.ref('ECSAutoScalingGroup'),
                "ScalingAdjustment" : 2
            }
        },
        "ECSAutoScalingGroup": {
            "Type": "AWS::AutoScaling::AutoScalingGroup",
            "Properties": {
                "AvailabilityZones": [ "us-east-1a" ],
                "LaunchConfigurationName": cf.ref('ECSLaunchConfiguration'),
                "MinSize": 1,
                "MaxSize": cf.ref('MaxClusterSize'),
                "DesiredCapacity": cf.ref('ClusterSize'),
                "Tags": [{ "Key": "Name", "Value": { "Fn::Sub": "machine-ecs-${ClusterName} ECS host" }, "PropagateAtLaunch": true }]
            },
            "CreationPolicy": { "ResourceSignal": { "Timeout": "PT15M" } },
            "UpdatePolicy": {
                "AutoScalingRollingUpdate": {
                    "MinInstancesInService": 1,
                    "MaxBatchSize": 3,
                    "PauseTime": "PT15M",
                    "SuspendProcesses": [ "HealthCheck", "ReplaceUnhealthy", "AZRebalance", "AlarmNotification", "ScheduledActions" ],
                    "WaitOnResourceSignals": true
                }
            }
        },
        "ECSHostSecurityGroup": {
            "Type": "AWS::EC2::SecurityGroup",
            "Properties": {
                "GroupDescription": "Access to the ECS hosts and the tasks/containers that run on them",
                "SecurityGroupIngress":[{ "CidrIp": "0.0.0.0/0", "IpProtocol": -1 }],
                "Tags": [{ "Key": "Name", "Value": { "Fn::Sub": "machine-ecs-${ClusterName}-ECSHostSecurityGroup" }}]
            }
        },
        "ECSLaunchConfiguration": {
            "Type": "AWS::AutoScaling::LaunchConfiguration",
            "Properties": {
                "ImageId": "ami-a7a242da",
                "InstanceType": cf.ref('InstanceType'),
                "SecurityGroups": [ cf.ref('ECSHostSecurityGroup') ],
                "IamInstanceProfile": cf.ref('ECSInstanceProfile'),
                "UserData": {
                    "Fn::Base64": { "Fn::Sub": "#!/bin/bash\nyum install -y https://s3.amazonaws.com/ec2-downloads-windows/SSMAgent/latest/linux_amd64/amazon-ssm-agent.rpm\nyum install -y aws-cfn-bootstrap\n/opt/aws/bin/cfn-init -v --region ${AWS::Region} --stack ${AWS::StackName} --resource ECSLaunchConfiguration\n/opt/aws/bin/cfn-signal -e $? --region ${AWS::Region} --stack ${AWS::StackName} --resource ECSAutoScalingGroup\n" }
                }
            },
            "Metadata": {
                "AWS::CloudFormation::Init": {
                    "config": {
                        "packages": {
                            "yum": { "awslogs": [ ] }
                        },
                        "commands": {
                            "01_add_instance_to_cluster": { "command": { "Fn::Sub": "echo ECS_CLUSTER=${ECSCluster} >> /etc/ecs/ecs.config" } }
                        },
                        "files": {
                            "/etc/cfn/cfn-hup.conf": {
                                "mode": 256,
                                "owner": "root",
                                "group": "root",
                                "content": { "Fn::Sub": "[main]\nstack=${AWS::StackId}\nregion=${AWS::Region}\n" }
                            },
                            "/etc/cfn/hooks.d/cfn-auto-reloader.conf": {
                                "content": { "Fn::Sub": "[cfn-auto-reloader-hook]\ntriggers=post.update\npath=Resources.ECSLaunchConfiguration.Metadata.AWS::CloudFormation::Init\naction=/opt/aws/bin/cfn-init -v --region ${AWS::Region} --stack ${AWS::StackName} --resource ECSLaunchConfiguration\n" }
                            },
                            "/etc/awslogs/awscli.conf": {
                                "content": { "Fn::Sub": "[plugins]\ncwlogs = cwlogs\n[default]\nregion = ${AWS::Region}\n" }
                            },
                            "/etc/awslogs/awslogs.conf": {
                                "content": { "Fn::Sub": "[general]\nstate_file = /var/lib/awslogs/agent-state\n\n[/var/log/dmesg]\nfile = /var/log/dmesg\nlog_group_name = ${ECSCluster}-/var/log/dmesg\nlog_stream_name = ${ECSCluster}\n\n[/var/log/messages]\nfile = /var/log/messages\nlog_group_name = ${ECSCluster}-/var/log/messages\nlog_stream_name = ${ECSCluster}\ndatetime_format = %b %d %H:%M:%S\n\n[/var/log/docker]\nfile = /var/log/docker\nlog_group_name = ${ECSCluster}-/var/log/docker\nlog_stream_name = ${ECSCluster}\ndatetime_format = %Y-%m-%dT%H:%M:%S.%f\n\n[/var/log/ecs/ecs-init.log]\nfile = /var/log/ecs/ecs-init.log.*\nlog_group_name = ${ECSCluster}-/var/log/ecs/ecs-init.log\nlog_stream_name = ${ECSCluster}\ndatetime_format = %Y-%m-%dT%H:%M:%SZ\n\n[/var/log/ecs/ecs-agent.log]\nfile = /var/log/ecs/ecs-agent.log.*\nlog_group_name = ${ECSCluster}-/var/log/ecs/ecs-agent.log\nlog_stream_name = ${ECSCluster}\ndatetime_format = %Y-%m-%dT%H:%M:%SZ\n\n[/var/log/ecs/audit.log]\nfile = /var/log/ecs/audit.log.*\nlog_group_name = ${ECSCluster}-/var/log/ecs/audit.log\nlog_stream_name = ${ECSCluster}\ndatetime_format = %Y-%m-%dT%H:%M:%SZ\n" }
                            }
                        },
                        "services": {
                            "sysvinit": {
                                "cfn-hup": {
                                    "enabled": true,
                                    "ensureRunning": true,
                                    "files": [ "/etc/cfn/cfn-hup.conf", "/etc/cfn/hooks.d/cfn-auto-reloader.conf" ]
                                },
                                "awslogs": {
                                    "enabled": true,
                                    "ensureRunning": true,
                                    "files": [ "/etc/awslogs/awslogs.conf", "/etc/awslogs/awscli.conf" ]
                                }
                            }
                        }
                    }
                }
            }
        },
        "ECSInstanceProfile": {
            "Type": "AWS::IAM::InstanceProfile",
            "Properties": { "Path": "/", "Roles": [ cf.ref('ECSRole') ]
            }
        },
        "TaskCreationUser": {
            "Type": "AWS::IAM::User",
            "Properties": { "Groups": [ cf.ref('TaskCreationGroup') ] }
        },
        "TaskCreationKey": {
            "Type": "AWS::IAM::AccessKey",
            "Properties": { "UserName": cf.ref('TaskCreationUser') }
        },
        "TaskCreationGroup": {
            "Type": "AWS::IAM::Group",
            "Properties": {
                "Policies": [{
                    "PolicyName": "TaskCreationPublish",
                    "PolicyDocument": {
                        "Statement": [{
                            "Effect": "Allow",
                            "Action": [
                                "ecr:BatchCheckLayerAvailability",
                                "ecr:BatchGetImage",
                                "ecr:CreateRepository",
                                "ecr:DescribeRepositories",
                                "ecr:GetAuthorizationToken",
                                "ecr:GetDownloadUrlForLayer",
                                "ecr:InitiateLayerUpload",
                                "ecr:CompleteLayerUpload",
                                "ecr:UploadLayerPart",
                                "ecr:PutImage"
                            ],
                            "Resource": "*"
                        }]
                    }
                }]
            }
        },
        "ECSIAM": {
            "Type": "AWS::IAM::Policy",
            "Properties": {
                "PolicyName": "ECSIAM",
                "Roles": [ cf.ref('ECSRole') ],
                "PolicyDocument": {
                    "Statement": [{
                        "Effect": "Allow",
                        "Action": [
                            "ecs:CreateCluster",
                            "ecs:DeregisterContainerInstance",
                            "ecs:DiscoverPollEndpoint",
                            "ecs:Poll",
                            "ecs:RegisterContainerInstance",
                            "ecs:StartTelemetrySession",
                            "ecs:Submit*",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents",
                            "ecr:BatchCheckLayerAvailability",
                            "ecr:BatchGetImage",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:GetAuthorizationToken",
                            "ssm:DescribeAssociation",
                            "ssm:GetDeployablePatchSnapshotForInstance",
                            "ssm:GetDocument",
                            "ssm:GetManifest",
                            "ssm:GetParameters",
                            "ssm:ListAssociations",
                            "ssm:ListInstanceAssociations",
                            "ssm:PutInventory",
                            "ssm:PutComplianceItems",
                            "ssm:PutConfigurePackageResult",
                            "ssm:UpdateAssociationStatus",
                            "ssm:UpdateInstanceAssociationStatus",
                            "ssm:UpdateInstanceInformation",
                            "ec2messages:AcknowledgeMessage",
                            "ec2messages:DeleteMessage",
                            "ec2messages:FailMessage",
                            "ec2messages:GetEndpoint",
                            "ec2messages:GetMessages",
                            "ec2messages:SendReply",
                            "cloudwatch:PutMetricData",
                            "ec2:DescribeInstanceStatus",
                            "ds:CreateComputer",
                            "ds:DescribeDirectories",
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:DescribeLogGroups",
                            "logs:DescribeLogStreams",
                            "logs:PutLogEvents"
                        ],
                        "Resource": "*"
                    }]
                }
            }
        },
        "ECSRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "Path": "/",
                "RoleName": cf.join([cf.ref('ECSCluster'), '-ECSRole']),
                "AssumeRolePolicyDocument": { "Statement": [{ "Action": "sts:AssumeRole", "Effect": "Allow", "Principal": { "Service": "ec2.amazonaws.com" } }] }
            }
        },
        "ECSServiceAutoScalingRole": {
            "Type": "AWS::IAM::Role",
            "Properties": {
                "AssumeRolePolicyDocument": {
                    "Version": "2012-10-17",
                    "Statement": {
                        "Action": [ "sts:AssumeRole" ],
                        "Effect": "Allow",
                        "Principal": { "Service": [ "application-autoscaling.amazonaws.com" ] }
                    }
                },
                "Path": "/",
                "Policies": [{
                    "PolicyName": "ecs-service-autoscaling",
                    "PolicyDocument": {
                        "Statement": {
                            "Effect": "Allow",
                            "Action": [ "application-autoscaling:*", "cloudwatch:DescribeAlarms", "cloudwatch:PutMetricAlarm", "ecs:DescribeServices", "ecs:UpdateService" ],
                            "Resource": "*"
                        }
                    }
                }]
            }
        }
    },
    "Outputs": {
        "Cluster": {
            "Description": "A reference to the ECS cluster",
            "Value": cf.join(['arn:aws:ecs:', cf.region, ':', cf.accountId, ':cluster/', cf.ref('ECSCluster')])
        },
        "CiAwsAccessKeyId": {
            "Description": "AWS Creds for Docker Image CI Builder",
            "Value": cf.ref('TaskCreationKey')
        },
        "CiAwsSecretAccessKey": {
            "Description": "AWS Creds for Docker Image CI Builder",
            "Value": { "Fn::GetAtt": [ "TaskCreationKey", "SecretAccessKey" ] }
        }
    }
}

