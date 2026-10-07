import { INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
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
const attempts = [
  {
    id: '70216a5c-2f02-4ea4-82a0-25d31997f9c2',
    orderId: order.id,
    attemptNumber: 1,
    status: 'ERROR',
    errorDescription: 'Gateway timeout',
    createdAt: order.createdAt,
  },
];

describe('PaymentOrdersController HTTP contract', () => {
  let app: INestApplication<App>;
  const paymentOrdersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    findAttempts: vi.fn(),
    getStats: vi.fn(),
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
    paymentOrdersService.findOne.mockResolvedValue({ ...order, attempts });
    paymentOrdersService.findAttempts.mockResolvedValue(attempts);
    paymentOrdersService.getStats.mockResolvedValue({
      total: 3,
      pending: 1,
      successful: 1,
      failed: 1,
      retried: 1,
      totalAttempts: 2,
    });
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
  }, 30_000);

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

  it('keeps list pagination and status filter contract unchanged', async () => {
    await request(app.getHttpServer())
      .get('/orders?page=2&limit=10&status=PENDING')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ page: 1, limit: 20, total: 1 });
      });
    expect(paymentOrdersService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 10,
        status: 'PENDING',
      }),
    );
  });

  it('returns full detail with attempts and maps absent order to 404', async () => {
    await request(app.getHttpServer())
      .get(`/orders/${order.id}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.retryCount).toBe(0);
        expect(body.lastError).toBeNull();
        expect(body.attempts).toHaveLength(1);
      });
    expect(paymentOrdersService.findOne).toHaveBeenCalledWith(order.id);

    paymentOrdersService.findOne.mockRejectedValueOnce(
      new NotFoundException('Payment order was not found'),
    );
    await request(app.getHttpServer())
      .get('/orders/b436a766-e8fa-4800-824a-f1189eb32854')
      .expect(404);
  });

  it('routes stats before ID and validates attempt order IDs', async () => {
    await request(app.getHttpServer()).get('/orders/stats').expect(200);
    expect(paymentOrdersService.getStats).toHaveBeenCalledOnce();
    expect(paymentOrdersService.findOne).not.toHaveBeenCalledWith('stats');

    await request(app.getHttpServer())
      .get(`/orders/${order.id}/attempts`)
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));
    expect(paymentOrdersService.findAttempts).toHaveBeenCalledWith(order.id);

    await request(app.getHttpServer()).get('/orders/not-a-uuid/attempts').expect(400);
  });
});
