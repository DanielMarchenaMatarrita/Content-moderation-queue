import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UserRole } from '../../../../../generated/prisma/client.js';
import { CreateUserDto } from './create-user.dto.js';
import { ListUsersQueryDto } from './list-users-query.dto.js';

describe('users DTOs', () => {
  it('normalizes valid create input', async () => {
    const input = plainToInstance(CreateUserDto, {
      email: ' Person@Example.COM ',
      displayName: '  Ada Lovelace  ',
      password: 'correct-horse-battery-staple',
    });

    expect(await validate(input)).toEqual([]);
    expect(input).toMatchObject({
      email: 'person@example.com',
      displayName: 'Ada Lovelace',
    });
  });

  it.each([
    [{ email: 'bad-email', displayName: 'Ada', password: 'password1' }],
    [{ email: 'person@example.com', displayName: '   ', password: 'password1' }],
    [{ email: 'person@example.com', displayName: 'Ada', password: 'short' }],
    [
      {
        email: 'person@example.com',
        displayName: 'Ada',
        password: 'x'.repeat(129),
      },
    ],
  ])('rejects invalid create input', async (value) => {
    expect(await validate(plainToInstance(CreateUserDto, value))).not.toEqual([]);
  });

  it('transforms valid list pagination, role, and search input', async () => {
    const query = plainToInstance(ListUsersQueryDto, {
      page: '2',
      limit: '50',
      role: UserRole.MODERATOR,
      q: '  Ada  ',
    });

    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({
      page: 2,
      limit: 50,
      role: UserRole.MODERATOR,
      q: 'Ada',
    });
  });

  it.each([
    [{ page: '0' }],
    [{ limit: '101' }],
    [{ role: 'UNKNOWN' }],
    [{ q: '   ' }],
  ])('rejects invalid list input', async (value) => {
    expect(await validate(plainToInstance(ListUsersQueryDto, value))).not.toEqual([]);
  });
});
