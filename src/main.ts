import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { AppModule } from './app.module';
import { VersionHeaderInterceptor } from './common/interceptors/version-header.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
