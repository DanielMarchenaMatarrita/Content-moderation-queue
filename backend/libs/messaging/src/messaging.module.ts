import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { rabbitMqConfig } from './rabbitmq/rabbitmq.config.js';
import { RabbitMqConnectionService } from './rabbitmq/rabbitmq-connection.service.js';
import { PaygridTopologyService } from './rabbitmq/paygrid-topology.service.js';

@Module({
  imports: [ConfigModule.forRoot({ load: [rabbitMqConfig] })],
  providers: [RabbitMqConnectionService, PaygridTopologyService],
  exports: [RabbitMqConnectionService],
})
export class MessagingModule {}
