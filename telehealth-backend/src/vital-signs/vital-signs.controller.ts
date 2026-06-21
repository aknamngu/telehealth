import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { VitalSignsService } from './vital-signs.service';
import { CreateVitalSignDto } from './dto/create-vital-sign.dto';

@Controller('vital-signs')
export class VitalSignsController {
  constructor(private readonly vitalSignsService: VitalSignsService) {}

  // Cổng lưu chỉ số sinh tồn AI: POST http://localhost:3000/vital-signs
  @Post()
  create(@Body() createVitalSignDto: CreateVitalSignDto) {
    return this.vitalSignsService.create(createVitalSignDto);
  }

  // Cổng lấy lịch sử chỉ số của cuộc hẹn: GET http://localhost:3000/vital-signs/appointment/1
  @Get('appointment/:appointmentId')
  findByAppointment(@Param('appointmentId') appointmentId: string) {
    return this.vitalSignsService.findByAppointment(+appointmentId);
  }
}