import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ContentModule } from './content/content.module.js';
import { InternalDiagnosticsModule } from './internal/internal-diagnostics.module.js';
import { ModerationReadModule } from './moderation-read/moderation-read.module.js';
import { OutboxPublisherModule } from './outbox/outbox-publisher.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ContentModule,
    UsersModule,
    ModerationReadModule,
    InternalDiagnosticsModule,
    OutboxPublisherModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
