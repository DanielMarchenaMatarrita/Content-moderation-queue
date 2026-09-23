import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  ModerationHistoryResponseDto,
  ModerationResultResponseDto,
} from './dto/moderation-read-response.dto.js';
import { ModerationReadService } from './moderation-read.service.js';

@ApiTags('moderation')
@Controller()
export class ModerationReadController {
  constructor(private readonly moderationReadService: ModerationReadService) {}

  @Get('contents/:id/moderation-results')
  @ApiOperation({ summary: 'List moderation results for content' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ModerationResultResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Content ID must be a UUID.' })
  @ApiNotFoundResponse({ description: 'Content was not found.' })
  findResults(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.moderationReadService.findResults(id);
  }

  @Get('contents/:id/moderation-history')
  @ApiOperation({ summary: 'List moderation history for content' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: ModerationHistoryResponseDto, isArray: true })
  @ApiBadRequestResponse({ description: 'Content ID must be a UUID.' })
  @ApiNotFoundResponse({ description: 'Content was not found.' })
  findHistory(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.moderationReadService.findHistory(id);
  }
}
