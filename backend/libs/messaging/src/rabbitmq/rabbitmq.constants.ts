export const RABBITMQ_ENV = {
  url: 'RABBITMQ_URL',
} as const;

export const RABBITMQ_TOPOLOGY = {
  eventsExchange: {
    name: 'content.events',
    type: 'topic',
    durable: true,
  },
  contentSubmitted: {
    queueName: 'moderation.content-submitted.v1',
    retryExchange: {
      name: 'content.retry',
      type: 'direct',
      durable: true,
    },
    retryQueue: {
      name: 'moderation.content-submitted.retry.v1',
      routingKey: 'content.submitted.retry',
      delayMs: 5_000,
    },
    deadLetterExchange: {
      name: 'content.dlx',
      type: 'direct',
      durable: true,
    },
    deadLetterQueue: {
      name: 'moderation.content-submitted.dlq.v1',
      routingKey: 'content.submitted.dead',
    },
    retryHeader: 'x-retry-count',
    maxRetries: 3,
    publishTimeoutMs: 10_000,
  },
} as const;
