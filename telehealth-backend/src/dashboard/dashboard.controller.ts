import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  getMyDashboard(@CurrentUser() user: { sub: number; role: string }) {
    return this.dashboardService.getDashboardForUser(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('admin')
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT')
  @Get('patient')
  getPatientDashboard(@CurrentUser() user: { sub: number }) {
    return this.dashboardService.getPatientDashboard(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR')
  @Get('doctor')
  getDoctorDashboard(@CurrentUser() user: { sub: number }) {
    return this.dashboardService.getDoctorDashboard(user.sub);
  }
}