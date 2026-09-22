import { MessagePort } from 'node:worker_threads';
import { WorkerLifetimeService } from './worker-lifetime.service.js';

describe('WorkerLifetimeService', () => {
  it('owns a referenced handle until application shutdown', () => {
    const ref = vi.spyOn(MessagePort.prototype, 'ref');
    const close = vi.spyOn(MessagePort.prototype, 'close');
    const service = new WorkerLifetimeService();

    try {
      service.onApplicationBootstrap();

      expect(ref).toHaveBeenCalledOnce();

      service.beforeApplicationShutdown();
      expect(close).toHaveBeenCalledTimes(2);
    } finally {
      service.beforeApplicationShutdown();
      ref.mockRestore();
      close.mockRestore();
    }
  });
});
