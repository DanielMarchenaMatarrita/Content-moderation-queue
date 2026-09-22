import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { MessagingModule } from '@app/messaging';
import { ContentSubmittedConsumerService } from './content-submitted-consumer.service.js';
import { ContentSubmittedTopologyService } from './content-submitted-topology.service.js';
import { IdempotentMessageExecutorService } from './idempotent-message-executor.service.js';

@Module({
  imports: [MessagingModule, PrismaModule],
  providers: [
    ContentSubmittedConsumerService,
    ContentSubmittedTopologyService,
    IdempotentMessageExecutorService,
  ],
})
export class ModerationWorkerModule {}
