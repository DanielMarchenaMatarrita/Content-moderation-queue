import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { InternalDiagnosticsService } from './internal-diagnostics.service.js';
import { OutboxEventsController } from './outbox-events.controller.js';
import { ProcessedMessagesController } from './processed-messages.controller.js';

@Module({
  imports: [PrismaModule],
  controllers: [OutboxEventsController, ProcessedMessagesController],
  providers: [InternalDiagnosticsService],
})
export class InternalDiagnosticsModule {}
