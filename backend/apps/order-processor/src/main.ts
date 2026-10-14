import { NestFactory } from '@nestjs/core';
import { createStructuredLogger } from '@app/observability';
import { OrderProcessorModule } from './order-processor.module.js';

const app = await NestFactory.createApplicationContext(OrderProcessorModule, {
  logger: createStructuredLogger('order-processor'),
});
app.enableShutdownHooks();
