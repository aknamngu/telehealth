import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Cổng lưu tin nhắn chat: POST http://localhost:3000/messages
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Post()
  create(@Body() createMessageDto: CreateMessageDto, @CurrentUser() user: { sub: number; role: string }) {
    return this.messagesService.create(createMessageDto, user);
  }

  // Cổng lấy lịch sử tin nhắn phòng khám: GET http://localhost:3000/messages/appointment/1
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Get('appointment/:appointmentId')
  findByAppointment(@Param('appointmentId') appointmentId: string, @CurrentUser() user: { sub: number; role: string }) {
    return this.messagesService.findByAppointment(+appointmentId, user);
  }
}