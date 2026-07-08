import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { VersionHeaderInterceptor } from './common/interceptors/version-header.interceptor';

async function bootstrap() {
  console.log('[Bootstrap] Creating NestJS application...');

  // Configure HTTP server options for high concurrency
  const maxConnections = parseInt(process.env.MAX_HTTP_CONNECTIONS || '1000', 10);

  const app = await NestFactory.create(AppModule, {
    // Increase HTTP connection limits for high-load scenarios
    httpsOptions: undefined, // Using HTTP (not HTTPS)
  });

  console.log('[Bootstrap] Application created successfully');
  console.log(`[Bootstrap] Max HTTP connections: ${maxConnections}`);

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
      "India's most comprehensive dual-system addressing API supporting both traditional PINCODE (6-digit postal codes) and modern DIGIPIN (India Post's official 10-level grid-based geocoding system). Features 19,000+ pincodes with precise geographic boundaries, 150,000+ post offices, complete administrative hierarchy, seamless PINCODE ↔ DIGIPIN ↔ Coordinates conversion, distance calculator, reverse geocoding, and spatial queries with polygon-accurate location validation.",
    )
    .setVersion('1.0.0')
    .setContact(
      'PinPoint India',
      'https://pinpointindia.in',
      'support@pinpointindia.in',
    )
    .setLicense('Commercial', 'https://pinpointindia.in/terms')
    .addServer(
      process.env.API_BASE_URL || 'https://pynpoint.codesense.in',
      'Production API',
    )
    .addServer('http://localhost:3000', 'Local Development')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'X-API-Key',
        in: 'header',
        description: 'API key for authentication (recommended). Format: X-API-Key: your_api_key',
      },
      'api-key',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'API Key',
        description: 'Alternative: Bearer token authentication. Format: Authorization: Bearer your_api_key',
      },
      'bearer',
    )
    .addTag('pincodes', 'PINCODE operations - lookup, search, validation, and spatial queries')
    .addTag('administrative', 'Administrative boundaries - states, districts, and regions')
    .addTag('digipin', 'DIGIPIN operations - encode, decode, hierarchy, and reverse geocoding')
    .addTag('distance', 'Distance calculations - point-to-point and batch operations')
    .addTag('convert', 'Conversion operations - PINCODE ↔ DIGIPIN ↔ H3 ↔ Coordinates')
    .addTag('health', 'Health checks and API status')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Inject schema-level examples for RapidAPI compatibility
  // Read static `schema.example` from DTO classes and add to component schemas
  if (document.components && document.components.schemas) {
    const dtoClasses = [
      // Import dynamically to avoid circular dependencies
      require('./pincode/dto/pincode-query.dto').ReverseGeocodeDto,
      require('./pincode/dto/pincode-query.dto').LocatePincodeDto,
      require('./pincode/dto/pincode-query.dto').BulkPincodeLookupDto,
      require('./digipin/dto/digipin-request.dto').EncodeDigipinDto,
      require('./digipin/dto/digipin-request.dto').DecodeDigipinDto,
      require('./digipin/dto/digipin-request.dto').ValidateDigipinDto,
      require('./digipin/dto/digipin-request.dto').DigipinToPincodeDto,
      require('./distance/dto/distance-request.dto').CalculateDistanceDto,
      require('./distance/dto/distance-request.dto').BatchDistanceDto,
    ];

    for (const dtoClass of dtoClasses) {
      if (dtoClass && dtoClass.schema && dtoClass.schema.example) {
        const schemaName = dtoClass.name;
        if (document.components.schemas[schemaName]) {
          document.components.schemas[schemaName].example = dtoClass.schema.example;
        }
      }
    }
  }

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

  // Start the server and configure connection limits
  await app.listen(port, () => {
    // Access the underlying HTTP server and set connection limits
    const server = app.getHttpServer();
    if (server) {
      // Set maximum number of concurrent connections
      server.maxConnections = maxConnections;

      // Set keep-alive timeout (default 5s is too short for high load)
      server.keepAliveTimeout = 65000; // 65 seconds (higher than typical LB timeout of 60s)

      // Set headers timeout (must be higher than keepAliveTimeout)
      server.headersTimeout = 66000; // 66 seconds

      console.log(`[Bootstrap] ✅ HTTP server configured:`);
      console.log(`[Bootstrap]    - Max connections: ${maxConnections}`);
      console.log(`[Bootstrap]    - Keep-alive timeout: ${server.keepAliveTimeout}ms`);
      console.log(`[Bootstrap]    - Headers timeout: ${server.headersTimeout}ms`);
    }
  });

  console.log(`[Bootstrap] Server is listening on port ${port}`);
  console.log(`[Bootstrap] API Documentation: http://localhost:${port}/api/docs`);
  console.log(`[Bootstrap] OpenAPI JSON: http://localhost:${port}/api/docs-json`);
}
bootstrap();
