import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { MessagingModule } from '@app/messaging';
import { ContentSubmittedConsumerService } from './content-submitted-consumer.service.js';
import { ContentSubmittedTopologyService } from './content-submitted-topology.service.js';
import { IdempotentMessageExecutorService } from './idempotent-message-executor.service.js';
import { ContentModerationProcessorService } from './moderation/content-moderation-processor.service.js';
import { DeterministicModerationEngine } from './moderation/deterministic-moderation-engine.js';

@Module({
  imports: [MessagingModule, PrismaModule],
  providers: [
    ContentSubmittedConsumerService,
    ContentSubmittedTopologyService,
    ContentModerationProcessorService,
    DeterministicModerationEngine,
    IdempotentMessageExecutorService,
  ],
})
export class ModerationWorkerModule {}
