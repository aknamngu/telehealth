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

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}