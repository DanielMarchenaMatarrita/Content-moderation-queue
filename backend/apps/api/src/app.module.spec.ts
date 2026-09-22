import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from './app.module.js';
import { ContentModule } from './content/content.module.js';
import { OutboxPublisherModule } from './outbox/outbox-publisher.module.js';

describe('AppModule', () => {
  it('activates content API and outbox publisher modules', () => {
    const imports = Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule);
    expect(imports).toEqual(
      expect.arrayContaining([ContentModule, OutboxPublisherModule]),
    );
  });
});
