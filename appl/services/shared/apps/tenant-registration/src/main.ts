/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */
import { NestFactory } from '@nestjs/core';
import { RegistrationModule } from './registration/registration.module';

async function bootstrap() {
  const app = await NestFactory.create(RegistrationModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    preflightContinue: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });
  
  await app.listen(3000);
}
bootstrap();
