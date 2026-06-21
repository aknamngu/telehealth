import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'SieuBaoMatTeleHealth2026', // Chuỗi bí mật để mã hóa token
      signOptions: { expiresIn: '1d' }, // Token có hạn trong 1 ngày
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService], // Đưa UsersService vào đây để dùng chung
})
export class AuthModule {}