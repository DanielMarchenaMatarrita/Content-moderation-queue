import { Test, TestingModule } from '@nestjs/testing';
import { ModerationWorkerController } from './moderation-worker.controller.js';
import { ModerationWorkerService } from './moderation-worker.service.js';

describe('ModerationWorkerController', () => {
  let moderationWorkerController: ModerationWorkerController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ModerationWorkerController],
      providers: [ModerationWorkerService],
    }).compile();

    moderationWorkerController = app.get<ModerationWorkerController>(ModerationWorkerController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(moderationWorkerController.getHello()).toBe('Hello World!');
    });
  });
});
