import { Controller, Get, Post, Body } from '@nestjs/common';
import { CallLogsService } from './call-logs.service';
import { CreateCallLogDto } from './dto/create-call-log.dto';

@Controller('call-logs')
export class CallLogsController {
  constructor(private readonly callLogsService: CallLogsService) {}

  // Cổng tạo log cuộc gọi: POST http://localhost:3000/call-logs
  @Post()
  create(@Body() createCallLogDto: CreateCallLogDto) {
    return this.callLogsService.create(createCallLogDto);
  }

  // Cổng xem toàn bộ lịch sử cuộc gọi: GET http://localhost:3000/call-logs
  @Get()
  findAll() {
    return this.callLogsService.findAll();
  }
}