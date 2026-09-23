import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ListOutboxEventsQueryDto,
  ListProcessedMessagesQueryDto,
} from './internal-diagnostics-query.dto.js';

const eventId = '0f069398-9ece-44b6-8390-b130da447e79';

describe('internal diagnostics query DTOs', () => {
  it.each([ListOutboxEventsQueryDto, ListProcessedMessagesQueryDto])(
    'applies page and limit defaults for %s',
    async (Dto) => {
      const query = plainToInstance(Dto, {});

      expect(await validate(query)).toEqual([]);
      expect(query).toMatchObject({ page: 1, limit: 20 });
    },
  );

  it.each([
    { Dto: ListOutboxEventsQueryDto, value: { page: '0' } },
    { Dto: ListOutboxEventsQueryDto, value: { limit: '0' } },
    { Dto: ListOutboxEventsQueryDto, value: { limit: '101' } },
    { Dto: ListProcessedMessagesQueryDto, value: { page: '0' } },
    { Dto: ListProcessedMessagesQueryDto, value: { limit: '0' } },
    { Dto: ListProcessedMessagesQueryDto, value: { limit: '101' } },
  ])('rejects invalid pagination for $Dto.name', async ({ Dto, value }) => {
    expect(await validate(plainToInstance(Dto, value))).not.toEqual([]);
  });

  it('accepts valid UUID filters', async () => {
    const outbox = plainToInstance(ListOutboxEventsQueryDto, {
      aggregateId: eventId,
    });
    const processed = plainToInstance(ListProcessedMessagesQueryDto, {
      eventId,
    });

    expect(await validate(outbox)).toEqual([]);
    expect(await validate(processed)).toEqual([]);
  });

  it.each([
    { Dto: ListOutboxEventsQueryDto, value: { aggregateId: 'not-a-uuid' } },
    { Dto: ListProcessedMessagesQueryDto, value: { eventId: 'not-a-uuid' } },
  ])('rejects malformed UUID filters for $Dto.name', async ({ Dto, value }) => {
    expect(await validate(plainToInstance(Dto, value))).not.toEqual([]);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])('strictly transforms published=%s', async (value, expected) => {
    const query = plainToInstance(ListOutboxEventsQueryDto, { published: value });

    expect(await validate(query)).toEqual([]);
    expect(query.published).toBe(expected);
  });

  it.each(['1', '0', 'yes', 'no', 'TRUEE', 'invalid'])(
    'rejects published=%s',
    async (published) => {
      const query = plainToInstance(ListOutboxEventsQueryDto, { published });
      expect(await validate(query)).not.toEqual([]);
    },
  );
});
