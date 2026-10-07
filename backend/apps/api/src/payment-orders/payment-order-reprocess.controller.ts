import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ReprocessPaymentOrderDto } from './dto/reprocess-payment-order.dto.js';
import { ReprocessedPaymentOrderResponseDto } from './dto/payment-order-response.dto.js';
import { PaymentOrdersService } from './payment-orders.service.js';

@ApiTags('payment orders')
@Controller('payment-orders')
export class PaymentOrderReprocessController {
  constructor(private readonly paymentOrdersService: PaymentOrdersService) {}

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Reprocess a failed payment order' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({ type: ReprocessedPaymentOrderResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid order ID or recovery scenario.' })
  @ApiNotFoundResponse({ description: 'Payment order was not found.' })
  @ApiConflictResponse({ description: 'Payment order is not in FAILED state.' })
  reprocess(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReprocessPaymentOrderDto,
  ) {
    return this.paymentOrdersService.reprocess(id, input);
  }
}
