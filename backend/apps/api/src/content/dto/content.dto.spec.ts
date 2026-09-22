import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ContentStatus } from '../../../../../generated/prisma/client.js';
import { CreateContentDto } from './create-content.dto.js';
import { ListContentsQueryDto } from './list-contents-query.dto.js';

describe('content DTOs', () => {
  it('trims valid content input', async () => {
    const input = plainToInstance(CreateContentDto, {
      userId: '0f069398-9ece-44b6-8390-b130da447e79',
      body: '  Normal text  ',
    });
    expect(await validate(input)).toEqual([]);
    expect(input.body).toBe('Normal text');
  });

  it.each([
    [{ userId: 'not-a-uuid', body: 'text' }],
    [{ userId: '0f069398-9ece-44b6-8390-b130da447e79', body: '   ' }],
    [
      {
        userId: '0f069398-9ece-44b6-8390-b130da447e79',
        body: 'x'.repeat(10_001),
      },
    ],
  ])('rejects invalid create input', async (value) => {
    expect(await validate(plainToInstance(CreateContentDto, value))).not.toEqual(
      [],
    );
  });

  it('transforms and validates list pagination and filters', async () => {
    const query = plainToInstance(ListContentsQueryDto, {
      page: '2',
      limit: '50',
      status: ContentStatus.APPROVED,
      userId: '0f069398-9ece-44b6-8390-b130da447e79',
    });
    expect(await validate(query)).toEqual([]);
    expect(query).toMatchObject({ page: 2, limit: 50 });
  });

  it('rejects excessive page size and invalid filters', async () => {
    const query = plainToInstance(ListContentsQueryDto, {
      page: '0',
      limit: '101',
      status: 'UNKNOWN',
      userId: 'bad-id',
    });
    expect(await validate(query)).toHaveLength(4);
  });
});
