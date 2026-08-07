import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { MedicationRemindersService } from './medication-reminders.service';

@Controller('medication-reminders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicationRemindersController {
  constructor(private readonly service: MedicationRemindersService) {}

  // GET /medication-reminders - Lấy danh sách nhắc thuốc của bệnh nhân
  @Roles('PATIENT')
  @Get()
  findMyReminders(@CurrentUser() user: { sub: number }) {
    return this.service.findByPatient(user.sub);
  }

  // POST /medication-reminders - Tạo lịch nhắc mới
  @Roles('PATIENT')
  @Post()
  create(
    @CurrentUser() user: { sub: number },
    @Body() dto: { prescriptionId: number; medicineName: string; reminderTime: string }
  ) {
    return this.service.create(user.sub, dto);
  }

  // PATCH /medication-reminders/:id/toggle - Bật/tắt nhắc nhở
  @Roles('PATIENT')
  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @CurrentUser() user: { sub: number }) {
    return this.service.toggle(+id, user.sub);
  }

  // DELETE /medication-reminders/:id
  @Roles('PATIENT')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { sub: number }) {
    return this.service.remove(+id, user.sub);
  }
}
