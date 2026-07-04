import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // 1. Cổng đặt lịch hẹn mới: POST http://localhost:3000/appointments
  @Post()
  create(@Body() createAppointmentDto: CreateAppointmentDto) {
    return this.appointmentsService.create(createAppointmentDto);
  }

  // 2. Cổng lấy danh sách lịch hẹn: GET http://localhost:3000/appointments
  @Get()
  findAll() {
    return this.appointmentsService.findAll();
  }

  // 3. Cổng duyệt/hủy lịch hẹn: PATCH http://localhost:3000/appointments/:id/status
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.appointmentsService.updateStatus(+id, status);
  }

  // 4. Cổng lấy lịch sử bệnh án tổng hợp AI: GET http://localhost:3000/appointments/patient/:patientId/history
  @Get('patient/:patientId/history')
  getPatientHistory(@Param('patientId') patientId: string) {
    return this.appointmentsService.getPatientMedicalHistory(+patientId);
  }
}