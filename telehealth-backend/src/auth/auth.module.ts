import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: 'SieuBaoMatTeleHealth2026', // Chuỗi bí mật để mã hóa token
      signOptions: { expiresIn: '1d' }, // Token có hạn trong 1 ngày
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}