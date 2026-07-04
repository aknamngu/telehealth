import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  // Tiêm PrismaService vào ruột
  constructor(private readonly prisma: PrismaService) {}

  async create(createDoctorDto: CreateDoctorDto) {
    const { userId, specialty, experienceYears, bio } = createDoctorDto;

    // 1. Kiểm tra xem User này có tồn tại và có đúng là DOCTOR không
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'DOCTOR') {
      throw new BadRequestException('User này không tồn tại hoặc không phải là Bác sĩ!');
    }

    // 2. Dùng upsert: Nếu chưa có hồ sơ thì tạo, có rồi thì cập nhật thông tin mới
    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId: userId },
      update: { specialty, experienceYears, bio },
      create: { userId, specialty, experienceYears, bio },
    });

    return {
      message: "Cập nhật hồ sơ Bác sĩ thành công mỹ mãn!",
      data: profile,
    };
  }

  async findAll() {
    // Tìm tất cả User nào có role là DOCTOR và lôi kèm cái DoctorProfile của họ lên luôn
    const doctors = await this.prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: {
        id: true,
        email: true,
        fullName: true,
        doctorProfile: true, // Nối bảng bốc dữ liệu quan hệ cực mượt bằng Prisma
      },
    });

    return {
      message: "Lấy danh sách Bác sĩ thành công!",
      data: doctors,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} doctor`;
  }

  update(id: number, updateDoctorDto: UpdateDoctorDto) {
    return `This action updates a #${id} doctor`;
  }

  remove(id: number) {
    return `This action removes a #${id} doctor`;
  }
}