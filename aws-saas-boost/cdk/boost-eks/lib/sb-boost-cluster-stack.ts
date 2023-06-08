// lib/sb-boost-eks-cluster-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import { NginxIngressAddOn } from './nginx-ingress'; // WE IMPORT THE ADDON HERE

import { Stack, StackProps, CfnParameter, CfnOutput } from 'aws-cdk-lib';

import { BaselineInfraStack } from './baseline-infra/base-infra-stack';
import getTimeString from './baseline-infra/utils';

// import * as YAML from 'yaml';
// import * as path from "path";
// import * as fs from "fs";

export default class ClusterConstruct extends Construct {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id);

    const account = props?.env?.account!;
    const region = props?.env?.region!;

    const externalDnsHostname = "saasboost";
    // const awsLbControllerAddOn = new blueprints.AwsLoadBalancerControllerAddOn();
    // const nginxAddOn = new blueprints.NginxAddOn({ externalDnsHostname, values: {
    //   "controller": {
    //       "service": {
    //           "annotations": {
    //               "service.beta.kubernetes.io/aws-load-balancer-name": "nginx-ingress-svc",
    //               "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type": "instance",
    //               "service.beta.kubernetes.io/aws-load-balancer-scheme": "internet-facing",
    //               "service.beta.kubernetes.io/aws-load-balancer-backend-protocol": "tcp",
    //               "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled": "true",
    //               "service.beta.kubernetes.io/aws-load-balancer-type": "nlb"
    //           }
    //       }
    //     }
    //   }
    // });
    
    const nginxIngressAddOn = new NginxIngressAddOn;  
    const karpenterAddOn = new blueprints.KarpenterAddOn({
        values: {
          replicas: 1
        }
      });
    const metricsServerAddOn = new blueprints.MetricsServerAddOn({values: {
          name: "sb-metric"
        }});
    const addOns: Array<blueprints.ClusterAddOn>
             = [ metricsServerAddOn, karpenterAddOn, nginxIngressAddOn ];

    const blueprint = blueprints.EksBlueprint.builder()
                      .account(account)
                      .region(region)
                      .addOns(...addOns)
                      .teams()
                      .build(scope, id+'-stack');
                      
    //                  
    const timeStr = getTimeString();
    const baseline = new BaselineInfraStack(blueprint, 'BaselineStack', {
      AppClientId: "",
      elbUrl: "",
      Region: "",
      UserPoolId: "",
      TimeString: timeStr,
      EksCodeBuildArn: ""//eksCodeBuildArn.valueAsString,
    });
    
    new CfnOutput(blueprint, 'AuthInfoTable', { value: baseline.authInfoTableName });
    
    const clusterInfo = blueprint.getClusterInfo();                  
    new CfnOutput(blueprint, 'EKS-Version', { value: clusterInfo.version.version });
    
    const nlbService = clusterInfo.cluster.getServiceLoadBalancerAddress("ingress-nginx-controller", {namespace:'ingress-nginx'});
    new CfnOutput(blueprint, 'NLBDnsName', {
        value: nlbService,
        description: 'The DNS name of the NLB Service of Nginx Ingress Controller'
    });
    
  }
}
