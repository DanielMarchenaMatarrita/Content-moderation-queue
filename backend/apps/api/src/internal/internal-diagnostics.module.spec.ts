import { Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@app/database';
import { InternalDiagnosticsModule } from './internal-diagnostics.module.js';
import { InternalDiagnosticsService } from './internal-diagnostics.service.js';
import { OutboxEventsController } from './outbox-events.controller.js';
import { ProcessedMessagesController } from './processed-messages.controller.js';

const prismaStub = {};

@Module({
  providers: [{ provide: PrismaService, useValue: prismaStub }],
  exports: [PrismaService],
})
class PrismaTestModule {}

describe('InternalDiagnosticsModule', () => {
  it('depends only on Prisma and declares local diagnostics providers', () => {
    expect(Reflect.getMetadata(MODULE_METADATA.IMPORTS, InternalDiagnosticsModule)).toEqual([
      PrismaModule,
    ]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, InternalDiagnosticsModule),
    ).toEqual([OutboxEventsController, ProcessedMessagesController]);
    expect(Reflect.getMetadata(MODULE_METADATA.PROVIDERS, InternalDiagnosticsModule)).toEqual([
      InternalDiagnosticsService,
    ]);
  });

  it('resolves without messaging or runtime infrastructure providers', async () => {
    const module = await Test.createTestingModule({
      imports: [InternalDiagnosticsModule],
    })
      .overrideModule(PrismaModule)
      .useModule(PrismaTestModule)
      .compile();

    expect(module.get(PrismaService)).toBe(prismaStub);
    expect(module.get(InternalDiagnosticsService)).toBeInstanceOf(
      InternalDiagnosticsService,
    );
    expect(module.get(OutboxEventsController)).toBeInstanceOf(OutboxEventsController);
    expect(module.get(ProcessedMessagesController)).toBeInstanceOf(
      ProcessedMessagesController,
    );
    await module.close();
  });
});
