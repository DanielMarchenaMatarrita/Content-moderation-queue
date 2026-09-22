import { Controller, Get } from '@nestjs/common';
import { ModerationWorkerService } from './moderation-worker.service.js';

@Controller()
export class ModerationWorkerController {
  constructor(private readonly moderationWorkerService: ModerationWorkerService) {}

  @Get()
  getHello(): string {
    return this.moderationWorkerService.getHello();
  }
}
