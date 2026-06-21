import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  // Cổng lưu tin nhắn chat: POST http://localhost:3000/messages
  @Post()
  create(@Body() createMessageDto: CreateMessageDto) {
    return this.messagesService.create(createMessageDto);
  }

  // Cổng lấy lịch sử tin nhắn phòng khám: GET http://localhost:3000/messages/appointment/1
  @Get('appointment/:appointmentId')
  findByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.messagesService.findByAppointment(+appointmentId);
  }
}