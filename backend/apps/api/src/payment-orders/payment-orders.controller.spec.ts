import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { PaymentOrdersController } from './payment-orders.controller.js';
import { PaymentOrdersService } from './payment-orders.service.js';

const order = {
  id: 'b436a766-e8fa-4800-824a-f1189eb32855',
  amount: 1500,
  currency: 'USD',
  status: 'PENDING',
  simulationScenario: 'SUCCESS',
  retryCount: 0,
  lastError: null,
  createdAt: new Date('2026-10-03T12:00:00.000Z'),
  updatedAt: new Date('2026-10-03T12:00:00.000Z'),
  submissionEventId: 'fd65ea0d-2807-4cdf-a53d-744bf9ca63db',
};

describe('PaymentOrdersController HTTP contract', () => {
  let app: INestApplication<App>;
  const paymentOrdersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    paymentOrdersService.create.mockResolvedValue(order);
    paymentOrdersService.findAll.mockResolvedValue({
      items: [order],
      page: 1,
      limit: 20,
      total: 1,
    });
    paymentOrdersService.findOne.mockResolvedValue(order);
    const module = await Test.createTestingModule({
      controllers: [PaymentOrdersController],
      providers: [
        { provide: PaymentOrdersService, useValue: paymentOrdersService },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => app.close());

  it('creates a valid payment order', async () => {
    await request(app.getHttpServer())
      .post('/orders')
      .send({ amount: 1500, currency: 'USD', simulationScenario: 'SUCCESS' })
      .expect(201);
    expect(paymentOrdersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1500,
        currency: 'USD',
        simulationScenario: 'SUCCESS',
      }),
    );
  });

  it.each([
    { amount: 0, currency: 'USD', simulationScenario: 'SUCCESS' },
    { amount: 1.5, currency: 'USD', simulationScenario: 'SUCCESS' },
    { amount: 1500, currency: 'USD', simulationScenario: 'INVALID' },
  ])('rejects invalid amount or simulation scenario', async (body) => {
    await request(app.getHttpServer()).post('/orders').send(body).expect(400);
    expect(paymentOrdersService.create).not.toHaveBeenCalled();
  });
});
