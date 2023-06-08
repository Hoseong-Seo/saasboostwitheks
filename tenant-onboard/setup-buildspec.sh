#!/bin/bash


echo "Setup buildspec.yaml"
#git clone https://github.com/mobytoby/saas-factory-eks-workshop.git

read -p "Please enter your AWS SaaS Boost Environment label: " SAAS_BOOST_ENV
if [ -z "$SAAS_BOOST_ENV" ]; then
	echo "You must enter a AWS SaaS Boost Environment label to continue. Exiting."
	exit 1
fi

AWS_REGION=$(aws configure list | grep region | awk '{print $2}')
ACCOUNT_ID=$(aws sts get-caller-identity --output text --query ["Account"])

cp buildspec.txt buildspec.yaml
cp trust-policy.txt trust-policy.json

echo "Retrieve the EKS_UPDATE_KUBECONFIG"
export EKS_UPDATE_KUBECONFIG=$(aws cloudformation describe-stacks --stack-name cluster-stack   --query "Stacks[0].Outputs[?OutputKey=='clusterstackConfigCommand3CE2A6DC'].OutputValue" --output text)
echo ${EKS_UPDATE_KUBECONFIG}
sed -i 's,{{EKS_UPDATE_KUBECONFIG}},'"${EKS_UPDATE_KUBECONFIG}"',g' buildspec.yaml

echo "Replace AWS_REGION"
sed -i -e 's,{{AWS_REGION}},'$AWS_REGION',g' buildspec.yaml

echo "Replace ACCOUNT_ID"
sed -i -e 's,{{ACCOUNT_ID}},'$ACCOUNT_ID',g' buildspec.yaml

echo "Replace ecr repository name"
export SAAS_BOOST_CORE=$(aws cloudformation list-stacks  --query "StackSummaries[*].StackName" --stack-status-filter CREATE_IN_PROGRESS CREATE_COMPLETE ROLLBACK_IN_PROGRESS ROLLBACK_FAILED ROLLBACK_COMPLETE DELETE_IN_PROGRESS DELETE_FAILED UPDATE_IN_PROGRESS UPDATE_COMPLETE_CLEANUP_IN_PROGRESS UPDATE_COMPLETE UPDATE_ROLLBACK_IN_PROGRESS UPDATE_ROLLBACK_FAILED UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS UPDATE_ROLLBACK_COMPLETE REVIEW_IN_PROGRESS | jq -r '.[]|select( startswith("sb-'$SAAS_BOOST_ENV'-core"))')
echo ${SAAS_BOOST_CORE}
# sed -i -e 's,{{SAAS_BOOST_CORE}},'$SAAS_BOOST_CORE',g' buildspec.yaml

APPLICATION=$(aws cloudformation describe-stack-resources --stack-name ${SAAS_BOOST_CORE} --logical-resource-id application --query 'StackResources[0].PhysicalResourceId' --output text)
ORDER=$(aws cloudformation describe-stack-resources --stack-name ${SAAS_BOOST_CORE} --logical-resource-id order --query 'StackResources[0].PhysicalResourceId' --output text)
PRODUCT=$(aws cloudformation describe-stack-resources --stack-name ${SAAS_BOOST_CORE} --logical-resource-id product --query 'StackResources[0].PhysicalResourceId' --output text)
sed -i -e 's,{{APPLICATION}},'$APPLICATION',g' buildspec.yaml
sed -i -e 's,{{ORDER}},'$ORDER',g' buildspec.yaml
sed -i -e 's,{{PRODUCT}},'$PRODUCT',g' buildspec.yaml

echo "Replace EKS create Role"
export CLOUD9_ROLE=$(aws sts get-caller-identity --query "Arn" --output text | cut -d'/' -f2)
echo ${CLOUD9_ROLE}
sed -i -e 's,{{CLOUD9_ROLE}},'$CLOUD9_ROLE',g' buildspec.yaml

echo "Pipeline Execution Role"
export PIPELINE_ROLE=$(aws cloudformation describe-stack-resources --stack-name pipeline-stack --logical-resource-id TenantOnboardingRoleB5248B6A  --query 'StackResources[0].PhysicalResourceId' --output text)
echo ${PIPELINE_ROLE}
export PIPELINE_ROLE_ARN=$(aws iam list-roles --query "Roles[?RoleName == '${PIPELINE_ROLE}'].Arn" --output text)
echo ${PIPELINE_ROLE_ARN}
sed -i -e 's,{{PIPELINE_ROLE_ARN}},'$PIPELINE_ROLE_ARN',g' trust-policy.json

aws iam update-assume-role-policy --role-name ${CLOUD9_ROLE} --policy-document file://trust-policy.json
# {
#     "Version": "2012-10-17",
#     "Statement": [
#         {
#             "Effect": "Allow",
#             "Principal": {
#                 "AWS": "{{PIPELINE_ROLE_ARN}}",
#                 "Service": "ec2.amazonaws.com"
#             },
#             "Action": "sts:AssumeRole"
#         }
#     ]
# }


# {
#     "Version": "2012-10-17",
#     "Statement": [
#         {
#             "Effect": "Allow",
#             "Principal": {
#                 "AWS": "arn:aws:iam::033185771327:role/service-role/codebuild-eks-saas-build-service-role",
#                 "Service": "ec2.amazonaws.com"
#             },
#             "Action": "sts:AssumeRole"
#         }
#     ]
# }
#sed -i -e 's,{{CLOUD9_ROLE}},'$CLOUD9_ROLE',g' buildspec.yaml

