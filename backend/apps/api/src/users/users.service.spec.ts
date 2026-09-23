import { ConflictException, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';
import type { PrismaService } from '@app/database';
import { Prisma, UserRole } from '../../../../generated/prisma/client.js';
import { UsersService } from './users.service.js';

vi.mock('argon2', () => ({ hash: vi.fn() }));

const userId = '0f069398-9ece-44b6-8390-b130da447e79';
const createdAt = new Date('2026-09-22T12:00:00.000Z');
const publicUser = {
  id: userId,
  email: 'person@example.com',
  displayName: 'Ada Lovelace',
  role: UserRole.USER,
  createdAt,
  updatedAt: createdAt,
};

function createHarness() {
  const user = {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(publicUser),
    findMany: vi.fn().mockResolvedValue([publicUser]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue(publicUser),
  };
  const $transaction = vi.fn().mockImplementation((queries: Promise<unknown>[]) =>
    Promise.all(queries),
  );
  const prisma = { user, $transaction } as unknown as PrismaService;

  return { service: new UsersService(prisma), user, $transaction };
}

function knownPrismaError(code: string, target?: string[]) {
  return new Prisma.PrismaClientKnownRequestError('database error', {
    code,
    clientVersion: '7.10.0',
    meta: target ? { target } : undefined,
  });
}

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hash).mockResolvedValue('$argon2id$hashed-password');
  });

  it('normalizes email, hashes the password, and persists an explicit USER role', async () => {
    const harness = createHarness();

    await expect(
      harness.service.create({
        email: ' Person@Example.COM ',
        displayName: '  Ada Lovelace  ',
        password: 'correct-horse-battery-staple',
      }),
    ).resolves.toEqual(publicUser);

    expect(harness.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'person@example.com', mode: 'insensitive' } },
      select: { id: true },
    });
    expect(hash).toHaveBeenCalledWith('correct-horse-battery-staple');
    expect(harness.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          email: 'person@example.com',
          displayName: 'Ada Lovelace',
          passwordHash: '$argon2id$hashed-password',
          role: UserRole.USER,
        },
        select: expect.objectContaining({
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        }),
      }),
    );
    expect(harness.user.create.mock.calls[0][0].data).not.toHaveProperty('password');
    expect(publicUser).not.toHaveProperty('password');
    expect(publicUser).not.toHaveProperty('passwordHash');
  });

  it('rejects an equivalent email before hashing or creating', async () => {
    const harness = createHarness();
    harness.user.findFirst.mockResolvedValueOnce({ id: userId });

    await expect(
      harness.service.create({
        email: 'PERSON@example.com',
        displayName: 'Ada Lovelace',
        password: 'correct-horse-battery-staple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(hash).not.toHaveBeenCalled();
    expect(harness.user.create).not.toHaveBeenCalled();
  });

  it('maps an email unique violation during create to conflict', async () => {
    const harness = createHarness();
    harness.user.create.mockRejectedValueOnce(knownPrismaError('P2002', ['email']));

    await expect(
      harness.service.create({
        email: 'person@example.com',
        displayName: 'Ada Lovelace',
        password: 'correct-horse-battery-staple',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('paginates users with role and case-insensitive search filters', async () => {
    const harness = createHarness();
    harness.user.count.mockResolvedValueOnce(41);

    await expect(
      harness.service.findAll({
        page: 3,
        limit: 20,
        role: UserRole.USER,
        q: ' Ada ',
      }),
    ).resolves.toEqual({ items: [publicUser], page: 3, limit: 20, total: 41 });

    const where = {
      role: UserRole.USER,
      OR: [
        { email: { contains: 'Ada', mode: 'insensitive' } },
        { displayName: { contains: 'Ada', mode: 'insensitive' } },
      ],
    };
    expect(harness.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        skip: 40,
        take: 20,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(harness.user.count).toHaveBeenCalledWith({ where });
    expect(harness.$transaction).toHaveBeenCalledOnce();
    expect(harness.user.findMany.mock.calls[0][0].select).not.toHaveProperty(
      'passwordHash',
    );
  });

  it('returns public user detail', async () => {
    const harness = createHarness();

    await expect(harness.service.findOne(userId)).resolves.toEqual(publicUser);
    expect(harness.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
  });

  it('throws NotFoundException for a missing user', async () => {
    const harness = createHarness();
    harness.user.findUnique.mockResolvedValueOnce(null);

    await expect(harness.service.findOne(userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
