// filename=lib/kyverno_addon.ts
import { Construct } from 'constructs';
import * as blueprints from '@aws-quickstart/eks-blueprints';
// import * as YAML from 'yaml';
// import * as path from "path";
// import * as fs from "fs";

// const file = fs.readFileSync(path.join(__dirname, "../values/nginx-value.yaml"), "utf8");
// const data = YAML.parse(file);

/**
 * User provided options for the Helm Chart
 */
export interface NginxIngressAddOnProps extends blueprints.HelmAddOnUserProps {
    version?: string,
    name: string, 
    createNamespace?: boolean,
    namespace: string
}

/**
 * Default props to be used when creating the Helm chart
 */
export const defaultProps: blueprints.HelmAddOnProps & NginxIngressAddOnProps = {
  name: "blueprints-nginx-ingress-addon",               // Internal identifyer for our add-on
  namespace: "ingress-nginx",          // Namespace used to deploy the chart
  chart: "ingress-nginx",              // Name of the Chart to be deployed
  version: "4.6.1",            // version of the chart 
  release: "ingress-nginx",            // Name for our chart in Kubernetes
  repository:  "https://kubernetes.github.io/ingress-nginx",        // HTTPS address of the chart repository
    values: {
        "controller": {
            "service": {
                "annotations": {
                    "service.beta.kubernetes.io/aws-load-balancer-name": "nginx-ingress-svc",
                    "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type": "instance",
                    "service.beta.kubernetes.io/aws-load-balancer-scheme": "internet-facing",
                    "service.beta.kubernetes.io/aws-load-balancer-backend-protocol": "tcp",
                    "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled": "true",
                    "service.beta.kubernetes.io/aws-load-balancer-type": "nlb"
                }
            }
        }
    }             // Additional chart values  
}


 /**
 * populateValues populates the appropriate values used to customize the Helm chart
 * @param helmOptions User provided values to customize the chart
 */
function populateValues(helmOptions: NginxIngressAddOnProps): blueprints.Values {
    const values = helmOptions.values ?? {};
    return values;
}

/**
 * Main class to instantiate the Helm chart
 */
export class NginxIngressAddOn extends blueprints.HelmAddOn {

  readonly options: NginxIngressAddOnProps

  constructor(props?: NginxIngressAddOnProps) {
    super({...defaultProps, ...props});
    this.options = this.props as NginxIngressAddOnProps;
  }

   deploy(clusterInfo: blueprints.ClusterInfo): Promise<Construct> {
     const values: blueprints.Values = populateValues(this.options);
     const chart = this.addHelmChart(clusterInfo, values);
     return Promise.resolve(chart);
   }
}
