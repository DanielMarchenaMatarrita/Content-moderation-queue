import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto.js';
import { ListPaymentOrdersQueryDto } from './dto/list-payment-orders-query.dto.js';
import {
  CreatedPaymentOrderResponseDto,
  PaymentOrderListResponseDto,
  PaymentOrderResponseDto,
} from './dto/payment-order-response.dto.js';
import { PaymentOrdersService } from './payment-orders.service.js';

@ApiTags('payment orders')
@Controller('orders')
export class PaymentOrdersController {
  constructor(private readonly paymentOrdersService: PaymentOrdersService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a payment order for asynchronous processing',
  })
  @ApiCreatedResponse({ type: CreatedPaymentOrderResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payment order input.' })
  create(@Body() input: CreatePaymentOrderDto) {
    return this.paymentOrdersService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List payment orders' })
  @ApiOkResponse({ type: PaymentOrderListResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or status filter.',
  })
  findAll(@Query() query: ListPaymentOrdersQueryDto) {
    return this.paymentOrdersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payment order by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PaymentOrderResponseDto })
  @ApiBadRequestResponse({ description: 'Payment order ID must be a UUID.' })
  @ApiNotFoundResponse({ description: 'Payment order was not found.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.paymentOrdersService.findOne(id);
  }
}
