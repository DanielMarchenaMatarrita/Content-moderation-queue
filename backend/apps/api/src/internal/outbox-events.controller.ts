import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ListOutboxEventsQueryDto } from './dto/internal-diagnostics-query.dto.js';
import {
  OutboxEventDetailDto,
  OutboxEventListResponseDto,
} from './dto/internal-diagnostics-response.dto.js';
import { InternalDiagnosticsService } from './internal-diagnostics.service.js';

@ApiTags('internal diagnostics')
@Controller('internal/outbox-events')
export class OutboxEventsController {
  constructor(private readonly diagnosticsService: InternalDiagnosticsService) {}

  @Get()
  @ApiOperation({ summary: 'List transactional outbox events' })
  @ApiOkResponse({ type: OutboxEventListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination or filter query.' })
  findAll(@Query() query: ListOutboxEventsQueryDto) {
    return this.diagnosticsService.findOutboxEvents(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a transactional outbox event by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: OutboxEventDetailDto })
  @ApiBadRequestResponse({ description: 'Outbox event ID must be a UUID.' })
  @ApiNotFoundResponse({ description: 'Outbox event was not found.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.diagnosticsService.findOutboxEvent(id);
  }
}
