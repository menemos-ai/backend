import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mnemos API')
    .setDescription(
      'REST API for the Mnemos decentralised agent-memory platform.\n\n' +
      '**Memory** — snapshot an agent\'s memory bundle to 0G Storage and mint an on-chain provenance token.\n\n' +
      '**Marketplace** — list, buy, rent, fork memory tokens and pay royalties to parent creators.\n\n' +
      'All `tokenId`, `price`, `rentalPricePerDay`, and `amount` values that represent EVM `uint256` ' +
      'are serialised as **decimal strings** to avoid JavaScript `BigInt` precision loss.',
    )
    .setVersion('1.0')
    .addTag('Memory', 'Store and retrieve agent memory bundles on 0G Storage')
    .addTag('Marketplace', 'List, trade, and monetise memory tokens')
    .addTag('Health', 'Service liveness probe')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Mnemos API running on http://localhost:${port}/api`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);
}

bootstrap();
