import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service.js';
import { CreateContentDto } from './dto/create-content.dto.js';
import { ListContentsQueryDto } from './dto/list-contents-query.dto.js';

@ApiTags('contents')
@Controller('contents')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Post()
  @ApiOperation({ summary: 'Submit content for asynchronous moderation' })
  @ApiCreatedResponse({ description: 'Content accepted with PENDING status' })
  create(@Body() input: CreateContentDto) {
    return this.contentService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List content submissions' })
  findAll(@Query() query: ListContentsQueryDto) {
    return this.contentService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get content and moderation state' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.contentService.findOne(id);
  }
}
