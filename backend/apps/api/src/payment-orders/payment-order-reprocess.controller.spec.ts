import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PaymentOrderReprocessController } from './payment-order-reprocess.controller.js';
import { PaymentOrdersService } from './payment-orders.service.js';

const orderId = 'b436a766-e8fa-4800-824a-f1189eb32855';

describe('PaymentOrderReprocessController HTTP contract', () => {
  let app: INestApplication<App>;
  const service = { reprocess: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    service.reprocess.mockResolvedValue({ id: orderId, status: 'PENDING', reprocessEventId: 'fd65ea0d-2807-4cdf-a53d-744bf9ca63db' });
    const module = await Test.createTestingModule({
      controllers: [PaymentOrderReprocessController],
      providers: [{ provide: PaymentOrdersService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterEach(async () => app.close());

  it('accepts an explicit supported recovery scenario', async () => {
    await request(app.getHttpServer()).post(`/payment-orders/${orderId}/reprocess`).send({ scenario: 'SUCCESS' }).expect(201);
    expect(service.reprocess).toHaveBeenCalledWith(orderId, { scenario: 'SUCCESS' });
  });

  it.each([{ scenario: 'INVALID' }, {}, { scenario: 'SUCCESS', unexpected: true }])(
    'rejects invalid recovery body',
    async (body) => {
      await request(app.getHttpServer()).post(`/payment-orders/${orderId}/reprocess`).send(body).expect(400);
      expect(service.reprocess).not.toHaveBeenCalled();
    },
  );
});
