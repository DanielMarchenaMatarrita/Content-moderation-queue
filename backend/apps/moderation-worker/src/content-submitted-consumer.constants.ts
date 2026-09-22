import { RABBITMQ_TOPOLOGY } from '@app/messaging';

export const CONTENT_SUBMITTED_CONSUMER_CONFIG = {
  queueName: RABBITMQ_TOPOLOGY.contentSubmitted.queueName,
  consumerName: 'moderation-worker.content-submitted.v1',
  prefetch: 10,
  autoConsume: true,
  maxRetries: RABBITMQ_TOPOLOGY.contentSubmitted.maxRetries,
} as const;
