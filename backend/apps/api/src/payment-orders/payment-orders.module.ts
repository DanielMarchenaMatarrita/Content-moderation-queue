import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { PaymentOrderReprocessController } from './payment-order-reprocess.controller.js';
import { PaymentOrdersController } from './payment-orders.controller.js';
import { PaymentOrdersService } from './payment-orders.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentOrdersController, PaymentOrderReprocessController],
  providers: [PaymentOrdersService],
})
export class PaymentOrdersModule {}
