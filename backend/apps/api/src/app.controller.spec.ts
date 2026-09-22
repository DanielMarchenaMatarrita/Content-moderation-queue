import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  const appController = new AppController(new AppService());

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
