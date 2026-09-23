import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ListProcessedMessagesQueryDto } from './dto/internal-diagnostics-query.dto.js';
import {
  ProcessedMessageListResponseDto,
  ProcessedMessageResponseDto,
} from './dto/internal-diagnostics-response.dto.js';
import { InternalDiagnosticsService } from './internal-diagnostics.service.js';

@ApiTags('internal diagnostics')
@Controller('internal/processed-messages')
export class ProcessedMessagesController {
  constructor(private readonly diagnosticsService: InternalDiagnosticsService) {}

  @Get()
  @ApiOperation({ summary: 'List processed-message markers' })
  @ApiOkResponse({ type: ProcessedMessageListResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid pagination or filter query.' })
  findAll(@Query() query: ListProcessedMessagesQueryDto) {
    return this.diagnosticsService.findProcessedMessages(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a processed-message marker by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ProcessedMessageResponseDto })
  @ApiBadRequestResponse({ description: 'Processed-message ID must be a UUID.' })
  @ApiNotFoundResponse({ description: 'Processed message was not found.' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.diagnosticsService.findProcessedMessage(id);
  }
}
