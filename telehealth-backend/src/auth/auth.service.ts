import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async login(body: any) {
    const { email, password } = body;

    // 1. Tìm người dùng theo email dưới DB Docker
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng rồi bạn ơi!');
    }

    // 2. Kiểm tra mật khẩu (Kiểm tra cả text thô cho user cũ và bcrypt cho user mới)
    const isMatch = password === user.password || await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng rồi bạn ơi!');
    }

    // 3. Tạo chiếc "thẻ thông hành" JWT Token chứa thông tin cơ bản
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      message: "Đăng nhập thành công rực rỡ!",
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}