import { RABBITMQ_TOPOLOGY } from '@app/messaging';

export const PAYMENT_ORDER_CREATED_CONSUMER_CONFIG = {
  queueName: RABBITMQ_TOPOLOGY.paygrid.paymentOrderCreated.queueName,
  consumerName: 'order-processor.payment-order-created.v1',
  prefetch: 10,
  maxRetries: RABBITMQ_TOPOLOGY.paygrid.paymentOrderCreated.maxRetries,
  autoConsume: true,
} as const;
