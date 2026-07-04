import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Mở cổng POST http://localhost:3000/auth/login
  @Post('login')
  login(@Body() body: any) {
    return this.authService.login(body);
  }
}