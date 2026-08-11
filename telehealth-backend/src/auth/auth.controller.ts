import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body);
  }

  @Post('2fa/login')
  completeTwoFactorLogin(
    @Body() body: { twoFactorToken?: string; code?: string },
  ) {
    return this.authService.completeTwoFactorLogin(body);
  }

  @Post('email/verify')
  verifyEmail(@Body() body: { email?: string; code?: string }) {
    return this.authService.verifyEmail(body);
  }

  @Post('email/resend')
  resendEmailOtp(@Body() body: { email?: string }) {
    return this.authService.resendEmailOtp(body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa/status')
  twoFactorStatus(@CurrentUser() user: { sub: number }) {
    return this.authService.twoFactorStatus(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  setupTwoFactor(@CurrentUser() user: { sub: number }) {
    return this.authService.setupTwoFactor(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enableTwoFactor(
    @CurrentUser() user: { sub: number },
    @Body('code') code: string,
  ) {
    return this.authService.enableTwoFactor(user.sub, code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disableTwoFactor(
    @CurrentUser() user: { sub: number },
    @Body() body: { password?: string; code?: string },
  ) {
    return this.authService.disableTwoFactor(user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { sub: number }) {
    return this.authService.me(user.sub);
  }
}
