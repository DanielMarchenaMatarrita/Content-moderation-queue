import {
  BeforeApplicationShutdown,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { MessageChannel } from 'node:worker_threads';

@Injectable()
export class WorkerLifetimeService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private keepAlive?: MessageChannel;

  onApplicationBootstrap(): void {
    if (this.keepAlive) {
      return;
    }

    this.keepAlive = new MessageChannel();
    this.keepAlive.port1.ref();
  }

  beforeApplicationShutdown(): void {
    this.keepAlive?.port1.close();
    this.keepAlive?.port2.close();
    this.keepAlive = undefined;
  }
}
