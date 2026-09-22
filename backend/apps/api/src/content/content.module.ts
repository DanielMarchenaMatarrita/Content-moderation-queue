import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { ContentController } from './content.controller.js';
import { ContentService } from './content.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [ContentController],
  providers: [ContentService],
})
export class ContentModule {}
