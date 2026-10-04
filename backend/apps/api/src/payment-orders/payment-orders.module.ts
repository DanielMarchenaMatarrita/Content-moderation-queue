import { Module } from '@nestjs/common';
import { PrismaModule } from '@app/database';

@Module({
  imports: [PrismaModule],
})
export class PaymentOrdersModule {}
