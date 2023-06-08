/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';

import { Injectable } from '@nestjs/common';
import { PLAN_TYPE, USERPOOL_TYPE } from '../models/types';
import { ClientFactoryService } from 'libs/client-factory/src';

@Injectable()
export class IdpService {
  authTableName = process.env.AUTH_TENANT_TABLE_NAME;
  tenantStackMappingTable = process.env.TENANT_STACK_MAPPING_TABLE_NAME;
  constructor(private clientFac: ClientFactoryService) {}

  // This pool was created as part of our baseline infrastructure
  // Just return it to start with
  async getPooledUserPool(): Promise<string> {
    const existingPoolId = await this.fetchForPath('app');
    return existingPoolId;
  }

  async getPlanBasedUserPool(tenantId: string, path: string, plan: PLAN_TYPE) {
    // Our pool type is based solely on Plan
    const poolType =
      plan === PLAN_TYPE.Premium ? USERPOOL_TYPE.Siloed : USERPOOL_TYPE.Pooled;
    // Our incoming 'Path' parameter is a shortened version of the company name
    // It's only used in the case this tenant is siloed.
    // All non-premium tenants will use the pooled compute which runs at http://abc.com/app
    // Premium tenants will run at http://abc.com/{pathToUse}
    const pathToUse = plan === PLAN_TYPE.Premium ? path : 'app';
    console.log('Fetching pool for this path:', pathToUse);
    // See if we have an existing entry based on the path.
    const existingPoolId = await this.fetchForPath(pathToUse);
    console.log('existingPoolId:', existingPoolId);
    if (!!existingPoolId) {
      return existingPoolId;
    }

    console.log('Existing pool not found. Creating new siloed pool');
    // If we get here, we're only interested in creating a siloed
    // tenant's user pool
    const poolName = `eks-ws-siloed-${tenantId}`;
    const userPool = await this.createUserPool(poolName, pathToUse);
    const userPoolClient = await this.createUserPoolClient(
      tenantId,
      userPool.Id,
      pathToUse,
    );
    await this.storeForPath(
      pathToUse,
      poolType,
      userPool.Id,
      userPoolClient.ClientId,
      tenantId,
    );
    await this.storeTenantStackMappingData(
      path,
      userPool.Id,
      userPoolClient.ClientId,
    );
    return userPool.Id;
  }

  private async fetchForPath(path: string) {
    const client = this.clientFac.client;
    const cmd = new GetCommand({
      Key: {
        tenant_path: path,
      },
      TableName: this.authTableName,
    });
    return (await client.send(cmd)).Item?.user_pool_id;
  }

  private async storeForPath(
    path: string,
    poolType: USERPOOL_TYPE,
    userPoolId: string,
    userPoolClientId: string,
    tenantId: string,
  ) {
    const authInfo = {
      tenant_path: path,
      user_pool_type: poolType,
      user_pool_id: userPoolId,
      client_id: userPoolClientId,
      tenantId: tenantId,
    };

    const client = this.clientFac.client;
    const cmd = new PutCommand({
      Item: authInfo,
      TableName: this.authTableName,
    });
    await client.send(cmd);
  }

  private async storeTenantStackMappingData(
    tenantName: string,
    userPoolId: string,
    userPoolClientId: string,
  ) {
    const tenantStackMapping = {
      TenantName: tenantName,
      UserPoolId: userPoolId,
      AppClientId: userPoolClientId,
      DeploymentStatus: 'Provisioning',
    };

    const client = this.clientFac.client;
    const cmd = new PutCommand({
      Item: tenantStackMapping,
      TableName: this.tenantStackMappingTable,
    });
    await client.send(cmd);
  }

  private async createUserPool(poolName: string, path: string) {
    const host = process.env.SERVICE_ADDRESS;
    const client = new CognitoIdentityProviderClient({});

    const command = new CreateUserPoolCommand({
      PoolName: poolName,
      AdminCreateUserConfig: {
        AllowAdminCreateUserOnly: true,
        InviteMessageTemplate: {
          EmailMessage: `<b>Welcome to the Anycompany's SaaS Application !!!</b> <br>
    <br>
    고객 서비스를 위한 접속 URL: <a href="https://${host}/${path}/index.html">http://${host}/${path}/index.html</a>
    <br>
    <br>
    저희 서비스를 이용해 주서셔 대단히 감사드립니다. <br>
    고객님의 환경을 프로비저닝하는데 몇 분정도 소요됩니다. <br>
    위 링크를 누르고 404에러가 보이면, 몇분 후에 다시 시도해주세요. <br>
    아래 제공된 임시 패스워드를 사용하여 접속해주세요.<br>
    <br>
    Your Username is: <b>{username}</b>
    <br>
    Your temporary Password is: <b>{####}</b>
    <br>`,
          EmailSubject:
            'Anycompany SaaS Application 임시 패스워드',
        },
      },
      //UsernameAttributes: ['email'],
      Schema: [
        {
          AttributeDataType: 'String',
          Name: 'email',
         //Required: true,
          Required: false,
          Mutable: true,
        },
        {
          AttributeDataType: 'String',
          Name: 'tenant-id',
          Required: false,
          Mutable: false,
        },
        {
          AttributeDataType: 'String',
          Name: 'company-name',
          Required: false,
          Mutable: false,
        },
        {
          AttributeDataType: 'String',
          Name: 'plan',
          Required: false,
          Mutable: false,
        },
        {
          AttributeDataType: 'String',
          Name: 'api-key',
          Required: false,
          Mutable: false,
        },
        {
          AttributeDataType: 'String',
          Name: 'path',
          Required: false,
          Mutable: false,
        },
      ],
    });
    const response = await client.send(command);
    return response.UserPool;
  }

  private async createUserPoolClient(
    tenantId: string,
    userPoolId: string,
    path: string,
  ) {
    const host = process.env.SERVICE_ADDRESS;
    const client = new CognitoIdentityProviderClient({});
    const command = new CreateUserPoolClientCommand({
      ClientName: tenantId,
      UserPoolId: userPoolId,
      ExplicitAuthFlows: [
        'ALLOW_ADMIN_USER_PASSWORD_AUTH',
        'ALLOW_USER_SRP_AUTH',
        'ALLOW_REFRESH_TOKEN_AUTH',
        'ALLOW_CUSTOM_AUTH',
      ],
      AllowedOAuthFlows: ['code', 'implicit'],
      AllowedOAuthScopes: ['email', 'phone', 'openid', 'profile'],
      CallbackURLs: [`https://${host}/${path}/index.html`],
      AllowedOAuthFlowsUserPoolClient: true,
      GenerateSecret: false,
      PreventUserExistenceErrors: 'ENABLED',
      RefreshTokenValidity: 30,
      SupportedIdentityProviders: ['COGNITO'],
    });
    const response = await client.send(command);

    return response.UserPoolClient;
  }
}
