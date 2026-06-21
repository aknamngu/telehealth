import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AiSummariesService } from './ai-summaries.service';
import { CreateAiSummaryDto } from './dto/create-ai-summary.dto';

@Controller('ai-summaries')
export class AiSummariesController {
  constructor(private readonly aiSummariesService: AiSummariesService) {}

  // Cổng lưu kết quả AI: POST http://localhost:3000/ai-summaries
  @Post()
  create(@Body() createAiSummaryDto: CreateAiSummaryDto) {
    return this.aiSummariesService.create(createAiSummaryDto);
  }

  // Cổng lấy kết quả AI của 1 cuộc hẹn: GET http://localhost:3000/ai-summaries/appointment/1
  @Get('appointment/:appointmentId')
  findByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.aiSummariesService.findByAppointment(+appointmentId);
  }
}