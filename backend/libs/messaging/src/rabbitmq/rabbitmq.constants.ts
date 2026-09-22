export const RABBITMQ_ENV = {
  url: 'RABBITMQ_URL',
} as const;

export const RABBITMQ_TOPOLOGY = {
  eventsExchange: {
    name: 'content.events',
    type: 'topic',
    durable: true,
  },
} as const;
