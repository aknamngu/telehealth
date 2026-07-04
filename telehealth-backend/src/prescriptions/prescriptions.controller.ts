import { Controller, Get, Post, Body, UseGuards, Param } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  // Cổng tạo đơn thuốc: POST http://localhost:3000/prescriptions
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  @Post()
  create(@Body() createPrescriptionDto: CreatePrescriptionDto, @CurrentUser() user: { sub: number; role: string }) {
    return this.prescriptionsService.create(createPrescriptionDto, user);
  }

  // Cổng lấy danh sách đơn thuốc: GET http://localhost:3000/prescriptions
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PATIENT', 'DOCTOR', 'ADMIN')
  @Get()
  findAll(@CurrentUser() user: { sub: number; role: string }) {
    return this.prescriptionsService.findAll(user);
  }
}