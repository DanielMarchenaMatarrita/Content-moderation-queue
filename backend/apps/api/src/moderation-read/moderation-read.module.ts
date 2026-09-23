import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { ModerationReadController } from './moderation-read.controller.js';
import { ModerationReadService } from './moderation-read.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ModerationReadController],
  providers: [ModerationReadService],
})
export class ModerationReadModule {}
