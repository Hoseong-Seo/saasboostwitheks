import { CfnOutput, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codecommit from "aws-cdk-lib/aws-codecommit";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";

export class PipelineCdkStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const sourceRepo = new codecommit.Repository(this, "tenant-onboard", {
      repositoryName: "tenant-onboard",
      description: "Repository for Tenant Onboarding",
    });

    const pipeline = new codepipeline.Pipeline(this, "eks-saas-pipeline", {
      pipelineName: "eks-saas-pipeline",
      crossAccountKeys: false,
    });

    const tenantOnboardingBuild = new codebuild.PipelineProject(this, 'Tenant Onboarding', {
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0, 
        privileged: true,
        computeType: codebuild.ComputeType.LARGE
      },
      buildSpec: codebuild.BuildSpec.fromSourceFilename('buildspec.yaml')
    });


    const sourceOutput = new codepipeline.Artifact();
    const unitTestOutput = new codepipeline.Artifact();

    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: "CodeCommit",
          repository: sourceRepo,
          output: sourceOutput,
          branch: "main",
        }),
      ],
    });

    pipeline.addStage({
      stageName: "CodeBuild",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "Tenant-Onboarding",
          project: tenantOnboardingBuild,
          input: sourceOutput,
          outputs: [unitTestOutput],
        }),
      ],
    });

    new CfnOutput(this, "CodeCommitRepositoryUrl", {
      value: sourceRepo.repositoryCloneUrlHttp,
    });
  }
}
