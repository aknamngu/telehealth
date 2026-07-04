import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // 1. Cổng đặt lịch hẹn mới: POST http://localhost:3000/appointments
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto, @CurrentUser() user: { sub: number; role: string }) {
    return this.appointmentsService.create(createAppointmentDto, user);
  }

  // 2. Cổng lấy danh sách lịch hẹn: GET http://localhost:3000/appointments
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'PATIENT')
  @Get()
  findAll(@CurrentUser() user: { sub: number; role: string }) {
    return this.appointmentsService.findAll(user);
  }

  // 3. Cổng duyệt/hủy lịch hẹn: PATCH http://localhost:3000/appointments/:id/status
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: { sub: number; role: string }) {
    return this.appointmentsService.updateStatus(+id, status, user);
  }

  // 4. Cổng lấy lịch sử bệnh án tổng hợp AI: GET http://localhost:3000/appointments/patient/:patientId/history
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DOCTOR', 'PATIENT')
  @Get('patient/:patientId/history')
  getPatientHistory(@Param('patientId') patientId: string, @CurrentUser() user: { sub: number; role: string }) {
    return this.appointmentsService.getPatientMedicalHistory(+patientId, user);
  }
}