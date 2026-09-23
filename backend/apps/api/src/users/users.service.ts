import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { hash } from 'argon2';
import { PrismaService } from '@app/database';
import { Prisma, UserRole } from '../../../../generated/prisma/client.js';
import type { CreateUserDto } from './dto/create-user.dto.js';
import type { ListUsersQueryDto } from './dto/list-users-query.dto.js';

const publicUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserDto) {
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hash(input.password);
    try {
      return await this.prisma.user.create({
        data: { email, displayName, passwordHash, role: UserRole.USER },
        select: publicUserSelect,
      });
    } catch (error) {
      if (this.isEmailUniqueViolation(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async findAll(query: ListUsersQueryDto) {
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role,
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { displayName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: publicUserSelect,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, page: query.page, limit: query.limit, total };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect,
    });

    if (!user) {
      throw new NotFoundException(`User ${id} was not found`);
    }
    return user;
  }

  private isEmailUniqueViolation(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    return Array.isArray(target)
      ? target.some((field) => field === 'email')
      : typeof target === 'string' && target.includes('email');
  }
}
