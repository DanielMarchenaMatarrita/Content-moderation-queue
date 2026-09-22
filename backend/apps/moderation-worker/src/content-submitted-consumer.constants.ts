export const CONTENT_SUBMITTED_CONSUMER_CONFIG = {
  queueName: 'moderation.content-submitted.v1',
  consumerName: 'moderation-worker.content-submitted.v1',
  prefetch: 10,
  autoConsume: true,
} as const;
