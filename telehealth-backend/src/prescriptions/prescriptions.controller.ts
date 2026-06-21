import { Controller, Get, Post, Body } from '@nestjs/common';
import { PrescriptionsService } from './prescriptions.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';

@Controller('prescriptions')
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  // Cổng tạo đơn thuốc: POST http://localhost:3000/prescriptions
  @Post()
  create(@Body() createPrescriptionDto: CreatePrescriptionDto) {
    return this.prescriptionsService.create(createPrescriptionDto);
  }

  // Cổng lấy danh sách đơn thuốc: GET http://localhost:3000/prescriptions
  @Get()
  findAll() {
    return this.prescriptionsService.findAll();
  }
}