import { NestFactory } from '@nestjs/core';
import { ModerationWorkerModule } from './moderation-worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(
    ModerationWorkerModule,
  );
  app.enableShutdownHooks();
}
await bootstrap();
