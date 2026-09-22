import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { rabbitMqConfig } from './rabbitmq/rabbitmq.config.js';
import { RabbitMqConnectionService } from './rabbitmq/rabbitmq-connection.service.js';

@Module({
  imports: [ConfigModule.forRoot({ load: [rabbitMqConfig] })],
  providers: [RabbitMqConnectionService],
  exports: [RabbitMqConnectionService],
})
export class MessagingModule {}
