import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
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

  // Cổng lấy chi tiết một bác sĩ: GET http://localhost:3000/doctors/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(+id);
  }

  // Lấy danh sách giờ rảnh của bác sĩ theo ngày: GET http://localhost:3000/doctors/:id/schedules?date=YYYY-MM-DD
  @Get(':id/schedules')
  getSchedules(@Param('id') id: string, @Query('date') date: string) {
    return this.doctorsService.getSchedules(+id, date);
  }

  // Thêm/xóa giờ rảnh của bác sĩ: POST http://localhost:3000/doctors/:id/schedules/toggle
  @Post(':id/schedules/toggle')
  toggleSchedule(
    @Param('id') id: string,
    @Body('date') date: string,
    @Body('startTime') startTime: string,
    @Body('endTime') endTime: string,
  ) {
    return this.doctorsService.toggleSchedule(+id, date, startTime, endTime);
  }
}