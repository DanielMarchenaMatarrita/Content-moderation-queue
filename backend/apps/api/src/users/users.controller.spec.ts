import { ConflictException, INestApplication, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const user = {
  id: '0f069398-9ece-44b6-8390-b130da447e79',
  email: 'person@example.com',
  displayName: 'Ada Lovelace',
  role: 'USER',
  createdAt: new Date('2026-09-22T12:00:00.000Z'),
  updatedAt: new Date('2026-09-22T12:00:00.000Z'),
};

describe('UsersController HTTP contract', () => {
  let app: INestApplication<App>;
  const usersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    usersService.create.mockResolvedValue(user);
    usersService.findAll.mockResolvedValue({ items: [user], page: 1, limit: 20, total: 1 });
    usersService.findOne.mockResolvedValue(user);

    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
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

  afterEach(async () => {
    await app.close();
  });

  it('creates a user through the HTTP contract without exposing credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({
        email: ' Person@Example.COM ',
        displayName: ' Ada Lovelace ',
        password: 'correct-horse-battery-staple',
      })
      .expect(201);

    expect(usersService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'person@example.com',
        displayName: 'Ada Lovelace',
        password: 'correct-horse-battery-staple',
      }),
    );
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it.each([
    [{ email: 'person@example.com', displayName: 'Ada', password: 'short' }],
    [
      {
        email: 'person@example.com',
        displayName: 'Ada',
        password: 'x'.repeat(129),
      },
    ],
    [
      {
        email: 'person@example.com',
        displayName: '   ',
        password: 'correct-horse-battery-staple',
      },
    ],
    [
      {
        email: 'person@example.com',
        displayName: 'Ada',
        password: 'correct-horse-battery-staple',
        role: 'ADMIN',
      },
    ],
  ])('rejects invalid or protected create input', async (body) => {
    await request(app.getHttpServer()).post('/users').send(body).expect(400);
    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('returns conflict for a duplicate email', async () => {
    usersService.create.mockRejectedValueOnce(
      new ConflictException('Email is already registered'),
    );

    await request(app.getHttpServer())
      .post('/users')
      .send({
        email: 'person@example.com',
        displayName: 'Ada',
        password: 'correct-horse-battery-staple',
      })
      .expect(409);
  });

  it('lists users with transformed defaults and filters', async () => {
    const response = await request(app.getHttpServer())
      .get('/users?role=USER&q=%20Ada%20')
      .expect(200);

    expect(usersService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20, role: 'USER', q: 'Ada' }),
    );
    expect(response.body.items[0]).not.toHaveProperty('passwordHash');
  });

  it('returns user detail and maps missing users to 404', async () => {
    await request(app.getHttpServer()).get(`/users/${user.id}`).expect(200);
    expect(usersService.findOne).toHaveBeenCalledWith(user.id);

    usersService.findOne.mockRejectedValueOnce(new NotFoundException());
    await request(app.getHttpServer()).get(`/users/${user.id}`).expect(404);
  });

  it('rejects malformed user IDs', async () => {
    await request(app.getHttpServer()).get('/users/not-a-uuid').expect(400);
    expect(usersService.findOne).not.toHaveBeenCalled();
  });

  it('documents Users API operations and error responses', () => {
    const document = SwaggerModule.createDocument(app, new DocumentBuilder().build());

    expect(document.paths).toHaveProperty('/users');
    expect(document.paths).toHaveProperty('/users/{id}');
    expect(document.paths['/users'].post?.responses).toEqual(
      expect.objectContaining({ '201': expect.any(Object), '400': expect.any(Object), '409': expect.any(Object) }),
    );
    expect(document.paths['/users/{id}'].get?.responses).toEqual(
      expect.objectContaining({ '200': expect.any(Object), '400': expect.any(Object), '404': expect.any(Object) }),
    );
    expect(document.paths['/users'].post?.tags).toContain('users');
  });
});
