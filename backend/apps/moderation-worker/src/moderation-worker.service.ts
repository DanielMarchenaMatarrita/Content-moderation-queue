import { Injectable } from '@nestjs/common';

@Injectable()
export class ModerationWorkerService {
  getHello(): string {
    return 'Hello World!';
  }
}
