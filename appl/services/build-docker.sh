#!/usr/bin/env bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License").
# You may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Get the ECR repo URI from the SaaS Boost console on the Settings page, the AWS console,
# CloudFormation outputs, or Parameter Store
# docker tag saas-boost:latest ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/${ECR_REPO}:latest
# docker push ${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/${ECR_REPO}:latest

read -p "Please enter your AWS SaaS Boost Environment label: " SAAS_BOOST_ENV
if [ -z "$SAAS_BOOST_ENV" ]; then
	echo "You must enter a AWS SaaS Boost Environment label to continue. Exiting."
	exit 1
fi

AWS_REGION=$(aws configure list | grep region | awk '{print $2}')
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --output text --query ["Account"])
echo "Using region: ${AWS_REGION} account: ${AWS_ACCOUNT_ID}"

echo "Creting DynamoDB Role for Tenant"
export KARPENTER_NODE_ROLE=$(aws cloudformation describe-stacks --stack-name cluster-stack   --query "Stacks[0].Outputs[?OutputKey=='KarpenterInstanceNodeRole'].OutputValue" --output text)
export CLUSTER_NODE_ROLE=$(aws cloudformation describe-stack-resources --stack-name cluster-stack --logical-resource-id clusterstackNodegroupclusterstackngngNodeGroupRole4F2925B8 --query 'StackResources[0].PhysicalResourceId' --output text)

cp ./dynamoPolicy.txt ./dynamoPolicy.json 
cp ./trust-policy.txt ./trust-policy.json 

sed -i -e 's,{{AWS_REGION}},'$AWS_REGION',g' ./dynamoPolicy.json
sed -i -e 's,{{ACCOUNT_ID}},'$AWS_ACCOUNT_ID',g' ./dynamoPolicy.json

sed -i -e 's,{{ACCOUNT_ID}},'$AWS_ACCOUNT_ID',g' ./trust-policy.json
sed -i -e 's,{{CLUSTER_NODE_GROUP}},'$CLUSTER_NODE_ROLE',g' ./trust-policy.json
sed -i -e 's,{{CLUSTER_KARPENTER_NODE}},'$KARPENTER_NODE_ROLE',g' ./trust-policy.json

aws iam create-role --role-name saasboost-tenant-dynamodb --assume-role-policy-document file://trust-policy.json || true
aws iam put-role-policy --role-name saasboost-tenant-dynamodb --policy-name dynamoPolicy --policy-document file://dynamoPolicy.json || true


read -a SERVICE_NAMES << EOF
$(aws ssm get-parameters-by-path --path /saas-boost/${SAAS_BOOST_ENV}/app/ --recursive --query "Parameters[?contains(Name, 'SERVICE_JSON')].Name" | grep SERVICE_JSON | cut -d\" -f2 | rev | cut -d/ -f2 | rev | tr '\n' ' ')
EOF
i=0
echo "${SAAS_BOOST_ENV} contains ${#SERVICE_NAMES[@]} services:"
for SERVICE in "${SERVICE_NAMES[@]}"; do
    echo "| ${i}: ${SERVICE}"
    i=$((i + 1))
done
read -p "Please enter the number of the service to upload to: " CHOSEN_SERVICE_INDEX
CHOSEN_SERVICE="${SERVICE_NAMES[CHOSEN_SERVICE_INDEX]}"

SERVICE_JSON=$(aws ssm get-parameter --name /saas-boost/$SAAS_BOOST_ENV/app/$CHOSEN_SERVICE/SERVICE_JSON --output text --query "Parameter.Value")
ECR_REPO=$(echo $SERVICE_JSON | jq .compute.containerRepo - | cut -d\" -f2)
ECR_TAG=$(echo $SERVICE_JSON | jq .compute.containerTag - | cut -d\" -f2)
if [ -z "$ECR_REPO" ]; then
    echo "Something went wrong: can't get ECR repo from Parameter Store. Exiting."
    exit 1
fi
if [ -z "$ECR_TAG" ]; then
		ECR_TAG="latest"
fi
echo "Uploading to ${CHOSEN_SERVICE} repository ${ECR_REPO} using tag ${ECR_TAG}"

if [ "$AWS_REGION" = "cn-northwest-1" ] || [ "$AWS_REGION" = "cn-north-1" ]; then
	DOCKER_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com.cn/$ECR_REPO"
else
	DOCKER_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"
fi
DOCKER_TAG="$DOCKER_REPO:$ECR_TAG"

AWS_CLI_VERSION=$(aws --version 2>&1 | awk -F / '{print $2}' | cut -c 1)
if [ $AWS_CLI_VERSION = '1' ]; then
	echo "Running AWS CLI version 1"
	aws ecr get-login --no-include-email --region $AWS_REGION | awk '{print $6}' | docker login -u AWS --password-stdin $DOCKER_REPO
elif [ $AWS_CLI_VERSION = '2' ]; then
	echo "Running AWS CLI version 2"
	aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $DOCKER_REPO
else
	echo "Running unknown AWS CLI version"
fi


echo $DOCKER_TAG
cd application
docker image build -t $CHOSEN_SERVICE -f Dockerfile.$CHOSEN_SERVICE .
docker tag $CHOSEN_SERVICE:latest $DOCKER_TAG
docker push $DOCKER_TAG
