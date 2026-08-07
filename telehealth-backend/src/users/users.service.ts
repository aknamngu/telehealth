import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  // Tiêm PrismaService toàn cục vào để xài trực tiếp
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // 1. Kiểm tra xem email này đã tồn tại trong DB chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email này đã được đăng ký rồi bạn ơi!');
    }

    // 2. Tiến hành lưu user mới vào database Docker
    const newUser = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: createUserDto.password, // Tạm thời lưu text thô để test mạch chạy, sau này mình sẽ hash sau nha
        fullName: createUserDto.fullName,
        role: createUserDto.role || 'PATIENT',
        wallet: {
          create: {
            balance: 1000000,
          }
        }
      },
    });

    return {
      message: "Đăng ký tài khoản thành công rực rỡ!",
      data: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      }
    };
  }

  async findAll() {
    // Gọi TRỰC TIẾP từ this.prisma luôn
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return {
      message: "Lấy danh sách người dùng từ Database Docker thành công 100%!",
      data: users
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  async updateStatus(id: number, isActive: boolean) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return {
      message: `Đã ${isActive ? 'mở khóa' : 'khóa'} tài khoản thành công!`,
      data: user
    };
  }

  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        doctorProfile: true,
        patientProfile: true,
      }
    });
    return { message: 'Lấy hồ sơ thành công!', data: user };
  }

  // Bệnh nhân cập nhật hồ sơ y tế cá nhân
  async updatePatientProfile(userId: number, dto: { medicalHistory?: string; allergies?: string; bloodType?: string }) {
    const profile = await this.prisma.patientProfile.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    return { message: 'Cập nhật hồ sơ bệnh nhân thành công!', data: profile };
  }

  // Bác sĩ cập nhật hồ sơ chuyên môn (chuyển sang PENDING để Admin duyệt)
  async updateDoctorProfile(userId: number, dto: { specialty?: string; experienceYears?: number; bio?: string }) {
    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId },
      update: { ...dto, status: 'PENDING' },
      create: { userId, specialty: dto.specialty ?? '', experienceYears: dto.experienceYears ?? 0, bio: dto.bio, status: 'PENDING' },
    });
    return { message: 'Hồ sơ đã được gửi, đang chờ Admin phê duyệt!', data: profile };
  }

  // Admin phê duyệt hồ sơ Bác sĩ
  async approveDoctorProfile(userId: number, status: 'APPROVED' | 'REJECTED') {
    const profile = await this.prisma.doctorProfile.update({
      where: { userId },
      data: { status },
    });
    return { message: `Đã ${status === 'APPROVED' ? 'phê duyệt' : 'từ chối'} hồ sơ bác sĩ!`, data: profile };
  }

  // Lấy danh sách bác sĩ PENDING cho Admin duyệt
  async getPendingDoctors() {
    const profiles = await this.prisma.doctorProfile.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, fullName: true, email: true } } }
    });
    return { message: 'Lấy danh sách hồ sơ chờ duyệt thành công!', data: profiles };
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}