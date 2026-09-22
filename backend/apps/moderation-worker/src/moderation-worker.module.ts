import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { MessagingModule } from '@app/messaging';
import { ContentSubmittedConsumerService } from './content-submitted-consumer.service.js';
import { ContentSubmittedFailureRouterService } from './content-submitted-failure-router.service.js';
import { ContentSubmittedRuntimeConsumerService } from './content-submitted-runtime-consumer.service.js';
import { ContentSubmittedTopologyService } from './content-submitted-topology.service.js';
import { IdempotentMessageExecutorService } from './idempotent-message-executor.service.js';
import { ContentModerationProcessorService } from './moderation/content-moderation-processor.service.js';
import { DeterministicModerationEngine } from './moderation/deterministic-moderation-engine.js';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

@Module({
  imports: [MessagingModule, PrismaModule],
  providers: [
    ContentSubmittedConsumerService,
    ContentSubmittedFailureRouterService,
    ContentSubmittedRuntimeConsumerService,
    ContentSubmittedTopologyService,
    ContentModerationProcessorService,
    DeterministicModerationEngine,
    IdempotentMessageExecutorService,
    WorkerLifetimeService,
  ],
})
export class ModerationWorkerModule {}
