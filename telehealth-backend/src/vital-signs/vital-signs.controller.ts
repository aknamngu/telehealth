import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { VitalSignsService } from './vital-signs.service';
import { CreateVitalSignDto } from './dto/create-vital-sign.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('vital-signs')
export class VitalSignsController {
  constructor(private readonly vitalSignsService: VitalSignsService) {}

  // Cổng lưu chỉ số sinh tồn AI: POST http://localhost:3000/vital-signs
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  @Post()
  create(@Body() createVitalSignDto: CreateVitalSignDto, @CurrentUser() user: { sub: number; role: string }) {
    return this.vitalSignsService.create(createVitalSignDto, user);
  }

  // Cổng lấy lịch sử chỉ số của cuộc hẹn: GET http://localhost:3000/vital-signs/appointment/1
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Get('appointment/:appointmentId')
  findByAppointment(@Param('appointmentId') appointmentId: string, @CurrentUser() user: { sub: number; role: string }) {
    return this.vitalSignsService.findByAppointment(+appointmentId, user);
  }
}