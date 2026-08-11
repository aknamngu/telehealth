import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { MailService } from '../mail/mail.service';

const CURRENT_POLICY_VERSION = '2026-08-11';

@Injectable()
export class UsersService {
  // Tiêm PrismaService toàn cục vào để xài trực tiếp
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    if (
      !createUserDto.consentAccepted ||
      createUserDto.consentPolicyVersion !== CURRENT_POLICY_VERSION
    ) {
      throw new BadRequestException(
        'Bạn phải đọc và đồng ý chính sách bảo mật hiện hành để đăng ký.',
      );
    }

    if (!['PATIENT', 'DOCTOR'].includes(createUserDto.role || 'PATIENT')) {
      throw new BadRequestException('Vai trò đăng ký không hợp lệ.');
    }

    // 1. Kiểm tra xem email này đã tồn tại trong DB chưa
    const normalizedEmail = createUserDto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new BadRequestException('Email này đã được đăng ký rồi bạn ơi!');
    }

    // 2. Tiến hành lưu user mới vào database Docker
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const newUser = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        password: await bcrypt.hash(createUserDto.password, 10),
        fullName: createUserDto.fullName,
        role: createUserDto.role || 'PATIENT',
        preferredLanguage:
          createUserDto.preferredLanguage === 'en' ? 'en' : 'vi',
        consentAcceptedAt: new Date(),
        consentPolicyVersion: CURRENT_POLICY_VERSION,
        emailOtpHash: await bcrypt.hash(otp, 10),
        emailOtpExpiresAt: new Date(Date.now() + 5 * 60_000),
        emailOtpAttempts: 0,
        wallet: {
          create: {
            balance: 1000000,
          },
        },
      },
    });

    const delivery = await this.mail.sendVerificationOtp(
      newUser.email,
      newUser.fullName,
      otp,
    );

    return {
      message:
        delivery.mode === 'smtp'
          ? 'Đăng ký thành công. Mã OTP đã được gửi đến email của bạn.'
          : 'Đăng ký thành công. Dùng mã OTP local để xác minh email.',
      ...(delivery.devOtp ? { devOtp: delivery.devOtp } : {}),
      data: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
      },
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
      message: 'Lấy danh sách người dùng từ Database Docker thành công 100%!',
      data: users,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, _updateUserDto: UpdateUserDto) {
    void _updateUserDto;
    return `This action updates a #${id} user`;
  }

  async updateStatus(id: number, isActive: boolean) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return {
      message: `Đã ${isActive ? 'mở khóa' : 'khóa'} tài khoản thành công!`,
      data: user,
    };
  }

  async updateLanguage(id: number, preferredLanguage: string) {
    if (!['vi', 'en'].includes(preferredLanguage)) {
      throw new BadRequestException('Ngôn ngữ không được hỗ trợ.');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { preferredLanguage },
      select: { id: true, preferredLanguage: true },
    });
    return { message: 'Đã cập nhật ngôn ngữ giao diện.', data: user };
  }

  async getProfile(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        doctorProfile: true,
        patientProfile: true,
      },
    });
    return { message: 'Lấy hồ sơ thành công!', data: user };
  }

  // Bệnh nhân cập nhật hồ sơ y tế cá nhân
  async updatePatientProfile(
    userId: number,
    dto: { medicalHistory?: string; allergies?: string; bloodType?: string },
  ) {
    const profile = await this.prisma.patientProfile.upsert({
      where: { userId },
      update: dto,
      create: { userId, ...dto },
    });
    return { message: 'Cập nhật hồ sơ bệnh nhân thành công!', data: profile };
  }

  // Bác sĩ cập nhật hồ sơ chuyên môn (chuyển sang PENDING để Admin duyệt)
  async updateDoctorProfile(
    userId: number,
    dto: { specialty?: string; experienceYears?: number; bio?: string },
  ) {
    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId },
      update: { ...dto, status: 'PENDING' },
      create: {
        userId,
        specialty: dto.specialty ?? '',
        experienceYears: dto.experienceYears ?? 0,
        bio: dto.bio,
        status: 'PENDING',
      },
    });
    return {
      message: 'Hồ sơ đã được gửi, đang chờ Admin phê duyệt!',
      data: profile,
    };
  }

  // Admin phê duyệt hồ sơ Bác sĩ
  async approveDoctorProfile(userId: number, status: 'APPROVED' | 'REJECTED') {
    const profile = await this.prisma.doctorProfile.update({
      where: { userId },
      data: { status },
    });
    return {
      message: `Đã ${status === 'APPROVED' ? 'phê duyệt' : 'từ chối'} hồ sơ bác sĩ!`,
      data: profile,
    };
  }

  // Lấy danh sách bác sĩ PENDING cho Admin duyệt
  async getPendingDoctors() {
    const profiles = await this.prisma.doctorProfile.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });
    return {
      message: 'Lấy danh sách hồ sơ chờ duyệt thành công!',
      data: profiles,
    };
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
