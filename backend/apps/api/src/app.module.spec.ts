import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module.js';
import { ContentModule } from './content/content.module.js';
import { InternalDiagnosticsModule } from './internal/internal-diagnostics.module.js';
import { ModerationReadModule } from './moderation-read/moderation-read.module.js';
import { OutboxPublisherModule } from './outbox/outbox-publisher.module.js';
import { UsersModule } from './users/users.module.js';

describe('AppModule', () => {
  it('registers every API and runtime module exactly once', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
    expect(imports).toEqual([
      ContentModule,
      UsersModule,
      ModerationReadModule,
      InternalDiagnosticsModule,
      OutboxPublisherModule,
    ]);
  });
});
