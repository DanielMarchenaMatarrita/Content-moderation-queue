import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { MessagingModule } from '@app/messaging';
import { PaymentOrderCreatedConsumerService } from './payment-order-created-consumer.service.js';
import { PaymentOrderCreatedFailureRouterService } from './payment-order-created-failure-router.service.js';
import { PaymentOrderCreatedRuntimeConsumerService } from './payment-order-created-runtime-consumer.service.js';
import { PaymentOrderProcessorService } from './payment-order-processor.service.js';

@Module({
  imports: [MessagingModule, PrismaModule],
  providers: [
    PaymentOrderCreatedConsumerService,
    PaymentOrderCreatedFailureRouterService,
    PaymentOrderCreatedRuntimeConsumerService,
    PaymentOrderProcessorService,
  ],
})
export class OrderProcessorModule {}
