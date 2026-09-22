import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ContentModule } from './content/content.module.js';
import { OutboxPublisherModule } from './outbox/outbox-publisher.module.js';

@Module({
  imports: [ContentModule, OutboxPublisherModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
