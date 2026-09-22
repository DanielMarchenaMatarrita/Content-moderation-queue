import { Module } from '@nestjs/common';
import { ModerationWorkerController } from './moderation-worker.controller.js';
import { ModerationWorkerService } from './moderation-worker.service.js';

@Module({
  imports: [],
  controllers: [ModerationWorkerController],
  providers: [ModerationWorkerService],
})
export class ModerationWorkerModule {}
