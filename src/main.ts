import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation with transformation
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
    }),
  );

  // Enable CORS for frontend integration
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`MIR'AAT API running on http://localhost:${port}`);
  console.log(`Test endpoint: http://localhost:${port}/buildings/affected?lon=35.5177&lat=33.9022&radius=2000`);
}

bootstrap();
