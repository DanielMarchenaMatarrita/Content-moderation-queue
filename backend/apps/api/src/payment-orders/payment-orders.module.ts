import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';
import { PaymentOrdersController } from './payment-orders.controller.js';
import { PaymentOrdersService } from './payment-orders.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentOrdersController],
  providers: [PaymentOrdersService],
})
export class PaymentOrdersModule {}
