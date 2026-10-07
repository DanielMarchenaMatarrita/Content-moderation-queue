import { NestFactory } from '@nestjs/core';
import { OrderProcessorModule } from './order-processor.module.js';

const app = await NestFactory.createApplicationContext(OrderProcessorModule);
app.enableShutdownHooks();
