import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { MessagingModule } from '@app/messaging';
import { OutboxPublisherService } from './outbox-publisher.service.js';

@Module({
  imports: [PrismaModule, MessagingModule],
  providers: [OutboxPublisherService],
  exports: [OutboxPublisherService],
})
export class OutboxPublisherModule {}
