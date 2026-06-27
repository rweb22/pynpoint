import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { VersionHeaderInterceptor } from './common/interceptors/version-header.interceptor';

async function bootstrap() {
  console.log('[Bootstrap] Creating NestJS application...');
  const app = await NestFactory.create(AppModule);
  console.log('[Bootstrap] Application created successfully');

  // Enable API versioning (URI-based)
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'api/v',
  });

  // Enable global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties are present
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert types (e.g., string to number)
      },
    }),
  );

  // Add version headers to all responses
  app.useGlobalInterceptors(new VersionHeaderInterceptor());

  // Configure Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('PinPoint India API')
    .setDescription(
      "India's first dual-system addressing API supporting both traditional PINCODE (6-digit postal codes) and modern DIGIPIN (India's geocoding system based on H3 hexagonal grid). Features 150,000+ pincodes with complete PostGIS polygons, DIGIPIN integration with precise location accuracy, seamless PINCODE ↔ DIGIPIN ↔ Lat/Long conversion, distance calculator for delivery estimates, reverse geocoding, and spatial queries.",
    )
    .setVersion('1.0.0')
    .setContact(
      'PinPoint India',
      'https://pinpointindia.in',
      'support@pinpointindia.in',
    )
    .setLicense('Commercial', 'https://pinpointindia.in/terms')
    .addServer(
      process.env.API_BASE_URL || 'http://localhost:3000',
      'Production API',
    )
    .addServer('http://localhost:3000', 'Local Development')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API key for authentication. Get your API key at https://pinpointindia.in',
      },
      'api-key',
    )
    .addTag('pincodes', 'PINCODE operations - lookup, search, validation, and spatial queries')
    .addTag('administrative', 'Administrative boundaries - states, districts, and regions')
    .addTag('digipin', 'DIGIPIN operations - encode, decode, hierarchy, and reverse geocoding')
    .addTag('distance', 'Distance calculations - point-to-point and batch operations')
    .addTag('convert', 'Conversion operations - PINCODE ↔ DIGIPIN ↔ H3 ↔ Coordinates')
    .addTag('health', 'Health checks and API status')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'PinPoint India API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
    },
  });

  console.log('[Bootstrap] Swagger documentation available at /api/docs');

  const port = process.env.PORT ?? 3000;
  console.log(`[Bootstrap] Starting server on port ${port}...`);
  await app.listen(port);
  console.log(`[Bootstrap] Server is listening on port ${port}`);
  console.log(`[Bootstrap] API Documentation: http://localhost:${port}/api/docs`);
  console.log(`[Bootstrap] OpenAPI JSON: http://localhost:${port}/api/docs-json`);
}
bootstrap();
