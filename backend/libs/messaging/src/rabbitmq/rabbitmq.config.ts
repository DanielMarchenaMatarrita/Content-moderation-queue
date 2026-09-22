import { registerAs } from '@nestjs/config';
import { RABBITMQ_ENV } from './rabbitmq.constants.js';

export const rabbitMqConfig = registerAs('rabbitmq', () => ({
  url: process.env[RABBITMQ_ENV.url],
}));
