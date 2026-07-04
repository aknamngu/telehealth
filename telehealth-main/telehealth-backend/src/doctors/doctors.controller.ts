import { Controller, Get, Post, Body } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';

@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  // Cổng tạo hoặc cập nhật hồ sơ bác sĩ: POST http://localhost:3000/doctors
  @Post()
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorsService.create(createDoctorDto);
  }

  // Cổng lấy danh sách toàn bộ bác sĩ kèm profile: GET http://localhost:3000/doctors
  @Get()
  findAll() {
    return this.doctorsService.findAll();
  }
}