/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { v4 as uuid } from 'uuid';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ClientFactoryService } from '@app/client-factory';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PolicyType } from '@app/auth/credential-vendor';
// import {
// 	S3Client,
// 	GetObjectCommand,
// } from "@aws-sdk/client-s3";
import {Readable} from "stream";

var aws = require('aws-sdk')

const TENANT_NAME=process.env.TENANT_NAME;


@Injectable()
export class ProductsService {

  parm_json;
  constructor(private clientFac: ClientFactoryService) {
    //const S3= new aws.S3();
    // this.parm_json = S3.getObject({Bucket:"emrt1",Key:"spark-param.json",ResponseContentType:'application/json'})
    //           .promise().then(file=>{return file})
    //           .catch(error =>{return error});
    console.log( "TENANT_NAME:"+ process.env.TENANT_NAME );           
    this.parm_json = this.download(process.env.TENANT_NAME);
    console.log( "value:"+ this.parm_json );           
  }
  tableName: string = process.env.PRODUCT_TABLE_NAME;

  async create(createProductDto: CreateProductDto, tenantId: string) {
    const newProduct = {
      ...createProductDto,
      product_id: uuid(),
      tenant_id: tenantId,
    };
    console.log('Creating product:', newProduct);
    this.run_data(process.env.TENANT_NAME);
    try {
      const client = await this.fetchClient(tenantId);
      const cmd = new PutCommand({
        Item: newProduct,
        TableName: this.tableName,
      });
      client.send(cmd);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Something went wrong',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(tenantId: string) {
    console.log('Getting All Products for Tenant:', tenantId);
    try {
      const client = await this.fetchClient(tenantId);
      const cmd = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'tenant_id=:t_id',
        ExpressionAttributeValues: {
          ':t_id': tenantId,
        },
      });

      const response = await client.send(cmd);
      return JSON.stringify(response.Items);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Something went wrong',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string, tenantId: string) {
    try {
      console.log('Getting Product: ', id);
      const client = await this.fetchClient(tenantId);
      const cmd = new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'tenant_id=:t_id AND product_id=:p_id',
        ExpressionAttributeValues: {
          ':t_id': tenantId,
          ':p_id': id,
        },
      });
      const response = await client.send(cmd);
      return JSON.stringify(response.Items && response.Items[0]);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Something went wrong',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: string,
    tenantId: string,
    updateProductDto: UpdateProductDto,
  ) {
    try {
      console.log('Updating Product: ', id);
      const client = await this.fetchClient(tenantId);
      const cmd = new UpdateCommand({
        TableName: this.tableName,
        Key: {
          tenant_id: tenantId,
          product_id: id,
        },
        UpdateExpression: 'set #name = :n, #price = :p, #description = :d',
        ExpressionAttributeValues: {
          ':n': updateProductDto.name,
          ':p': updateProductDto.price,
          ':d': updateProductDto.description,
        },
        ExpressionAttributeNames: {
          '#name': 'name',
          '#price': 'price',
          '#description': 'description',
        },
      });

      const response = await client.send(cmd);
      console.log('Update Response:', response);
      return JSON.stringify(updateProductDto);
    } catch (error) {
      console.error(error);
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Something went wrong',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async fetchClient(tenantId: string) {
  //   return DynamoDBDocumentClient.from(new DynamoDBClient({}));
  // }
  async fetchClient(tenantId: string) {
    const client = await this.clientFac.getClient(tenantId, {
      policyType: PolicyType.DynamoDBLeadingKey,
      attributes: {
        table: this.tableName,
      },
    });
    return client;
  }
  
  
  async run_data(tenantId: string) {
    console.log('run_data run_data:' + tenantId);
  // run_data() {
    var parm_json = await this.download(tenantId);
    
    console.log("===>"+ this.parm_json);

    var params = {
      stateMachineArn: 'arn:aws:states:ap-northeast-2:754173030316:stateMachine:abp-stepfunction',
      // input: JSON.stringify({
      //   "comment": "A message in the state input",
      //   "virtualclusterId": "uqse4zln41dy3kgh7dgd8ppd0",
      //   "namespace": "emrt2",
      //   "executionroleArn": "arn:aws:iam::754173030316:role/emrt2-JobExecutionRole",
      //   "entrypoint": "s3://emrt2/spark_job.py",
      //   "loggroupname": "/emr-on-eks/abp-eks-cluster/emrt2",
      //   "lgouri": "s3://emrt2.namespace-logs-754173030316-ap-northeast-2/",
      //   "outputlocation": "s3://emrt2-athena/",
      //   "querystring": "CREATE EXTERNAL TABLE IF NOT EXISTS default.nyc_taxi_avg_summary(`type` string, `avgDist` double, `avgCostPerMile` double, `avgCost` double) ROW FORMAT SERDE   'org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe' STORED AS INPUTFORMAT   'org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat' OUTPUTFORMAT   'org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat' LOCATION  's3://emrt2/records/output/' TBLPROPERTIES ('classification'='parquet', 'compressionType'='none', 'typeOfData'='file')"
      // })
      input: this.parm_json
    };
    var stepfunctions = new aws.StepFunctions()
    stepfunctions.startExecution(params, (err, data) => {
      if (err) {
        console.log(err);
        const response = {
          statusCode: 500,
          body: JSON.stringify({
          message: 'There was an error'
          })
        };
      // callback(null, response);
      } else {
        console.log(data);
        const response = {
            statusCode: 200,
            body: JSON.stringify({
            message: 'Step function worked'
            })
        };
      // callback(null, response);
      }
    });
  }
  
  async download(tenantName: string){
    try {
      console.log("### tenantName:"+tenantName)
      const S3= new aws.S3();
      const data = await S3.getObject(
      {   Bucket: tenantName, 
          Key: "spark_param.json",
          ResponseContentType: 'application/json'
      }).promise();
  
      console.log(data.Body.toString('utf-8'));
      console.log(JSON.stringify(data.Body.toString('utf-8')));
      // return {
      //   statusCode: 200,
      //   body: JSON.stringify(data.Body.toString('utf-8'))
      // }
      this.parm_json = data.Body.toString('utf-8');
      return data.Body.toString('utf-8');
    }
    catch (err) {
      console.log("err:"+ err.message || JSON.stringify(err.message));
      return {
        statusCode: err.statusCode || 400,
        body: err.message || JSON.stringify(err.message)
      }
    }
  }


}
