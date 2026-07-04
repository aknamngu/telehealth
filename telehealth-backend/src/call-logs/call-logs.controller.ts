import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { CallLogsService } from './call-logs.service';
import { CreateCallLogDto } from './dto/create-call-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('call-logs')
export class CallLogsController {
  constructor(private readonly callLogsService: CallLogsService) {}

  // Cổng tạo log cuộc gọi: POST http://localhost:3000/call-logs
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  @Post()
  create(@Body() createCallLogDto: CreateCallLogDto, @CurrentUser() user: { sub: number; role: string }) {
    return this.callLogsService.create(createCallLogDto, user);
  }

  // Cổng xem toàn bộ lịch sử cuộc gọi: GET http://localhost:3000/call-logs
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Get()
  findAll(@CurrentUser() user: { sub: number; role: string }) {
    return this.callLogsService.findAll(user);
  }
}