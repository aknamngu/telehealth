import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
} from 'node:crypto';
import * as bcrypt from 'bcrypt';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma.service';
import { MailService } from '../mail/mail.service';
import { buildTotpUri, generateTotpSecret, verifyTotpCode } from './totp';

type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  role: string;
  createdAt: Date;
  preferredLanguage: string;
  twoFactorEnabled: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async login(body: { email?: string; password?: string }) {
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    const user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;

    if (!user || !(await this.passwordMatches(password, user.password))) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không đúng rồi bạn ơi!',
      );
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đang bị khóa.');
    }
    if (user.emailOtpHash && !user.emailVerifiedAt) {
      throw new UnauthorizedException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Bạn cần xác minh email trước khi đăng nhập.',
        email: user.email,
      });
    }

    if (user.twoFactorEnabled) {
      return {
        message: 'Vui lòng nhập mã từ Google Authenticator.',
        requiresTwoFactor: true,
        twoFactorToken: await this.jwtService.signAsync(
          { sub: user.id, purpose: 'two-factor-login' },
          { expiresIn: '5m' },
        ),
      };
    }

    return this.createSession(user);
  }

  async completeTwoFactorLogin(body: {
    twoFactorToken?: string;
    code?: string;
  }) {
    let payload: { sub: number; purpose?: string };
    try {
      payload = await this.jwtService.verifyAsync(body.twoFactorToken ?? '');
    } catch {
      throw new UnauthorizedException(
        'Phiên xác minh hai lớp đã hết hạn. Vui lòng đăng nhập lại.',
      );
    }
    if (payload.purpose !== 'two-factor-login') {
      throw new UnauthorizedException('Phiên xác minh hai lớp không hợp lệ.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Tài khoản chưa bật xác thực hai lớp.');
    }
    if (
      !verifyTotpCode(this.decryptSecret(user.twoFactorSecret), body.code ?? '')
    ) {
      throw new UnauthorizedException('Mã Google Authenticator không đúng.');
    }

    return this.createSession(user);
  }

  async verifyEmail(body: { email?: string; code?: string }) {
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim() ?? '';
    const user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;

    if (!user) throw new BadRequestException('Không tìm thấy tài khoản.');
    if (user.emailVerifiedAt && !user.emailOtpHash) {
      return { message: 'Email đã được xác minh trước đó.' };
    }
    if (!user.emailOtpHash || !user.emailOtpExpiresAt) {
      throw new BadRequestException('Chưa có mã OTP hợp lệ. Hãy gửi lại mã.');
    }
    if (user.emailOtpAttempts >= 5) {
      throw new BadRequestException(
        'Bạn đã nhập sai quá nhiều lần. Hãy gửi lại mã OTP.',
      );
    }
    if (user.emailOtpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Mã OTP đã hết hạn. Hãy gửi lại mã mới.');
    }

    const valid =
      /^\d{6}$/.test(code) && (await bcrypt.compare(code, user.emailOtpHash));
    if (!valid) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailOtpAttempts: { increment: 1 } },
      });
      throw new BadRequestException('Mã OTP không đúng.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailOtpHash: null,
        emailOtpExpiresAt: null,
        emailOtpAttempts: 0,
      },
    });
    return { message: 'Xác minh email thành công. Bạn có thể đăng nhập.' };
  }

  async resendEmailOtp(body: { email?: string }) {
    const email = body.email?.trim().toLowerCase();
    const user = email
      ? await this.prisma.user.findUnique({ where: { email } })
      : null;
    if (!user) throw new BadRequestException('Không tìm thấy tài khoản.');
    if (user.emailVerifiedAt && !user.emailOtpHash) {
      return { message: 'Email đã được xác minh trước đó.' };
    }

    const otp = this.generateEmailOtp();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailOtpHash: await bcrypt.hash(otp, 10),
        emailOtpExpiresAt: new Date(Date.now() + 5 * 60_000),
        emailOtpAttempts: 0,
      },
    });
    const delivery = await this.mail.sendVerificationOtp(
      user.email,
      user.fullName,
      otp,
    );
    return {
      message:
        delivery.mode === 'smtp'
          ? 'Đã gửi mã OTP mới đến email.'
          : 'Đã tạo mã OTP dùng cho môi trường local.',
      ...(delivery.devOtp ? { devOtp: delivery.devOtp } : {}),
    };
  }

  async twoFactorStatus(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        emailVerifiedAt: true,
        emailOtpHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản.');
    return {
      data: {
        email: user.email,
        emailVerified: Boolean(user.emailVerifiedAt) || !user.emailOtpHash,
        twoFactorEnabled: user.twoFactorEnabled,
        setupPending: Boolean(user.twoFactorSecret && !user.twoFactorEnabled),
      },
    };
  }

  async setupTwoFactor(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản.');
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Xác thực hai lớp đã được bật.');
    }

    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, user.email);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: this.encryptSecret(secret) },
    });

    return {
      message: 'Quét mã QR rồi nhập mã 6 số để hoàn tất.',
      data: {
        qrDataUrl: await QRCode.toDataURL(uri, { width: 280, margin: 1 }),
        manualKey: secret,
      },
    };
  }

  async enableTwoFactor(userId: number, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('Hãy tạo mã QR trước.');
    }
    if (!verifyTotpCode(this.decryptSecret(user.twoFactorSecret), code)) {
      throw new BadRequestException('Mã Google Authenticator không đúng.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    });
    return { message: 'Đã bật xác thực hai lớp thành công.' };
  }

  async disableTwoFactor(
    userId: number,
    body: { password?: string; code?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Xác thực hai lớp chưa được bật.');
    }
    if (!(await this.passwordMatches(body.password ?? '', user.password))) {
      throw new UnauthorizedException('Mật khẩu không đúng.');
    }
    if (
      !verifyTotpCode(this.decryptSecret(user.twoFactorSecret), body.code ?? '')
    ) {
      throw new BadRequestException('Mã Google Authenticator không đúng.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { message: 'Đã tắt xác thực hai lớp.' };
  }

  async me(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        preferredLanguage: true,
        emailVerifiedAt: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hợp lệ!');
    }
    return { message: 'Lấy thông tin tài khoản thành công!', data: user };
  }

  generateEmailOtp() {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private async createSession(user: {
    id: number;
    email: string;
    fullName: string;
    role: string;
    createdAt: Date;
    preferredLanguage: string;
    twoFactorEnabled: boolean;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
      preferredLanguage: user.preferredLanguage,
      twoFactorEnabled: user.twoFactorEnabled,
    };
    return {
      message: 'Đăng nhập thành công rực rỡ!',
      access_token: await this.jwtService.signAsync(payload),
      user: authUser,
    };
  }

  private async passwordMatches(password: string, storedPassword: string) {
    if (password === storedPassword) return true;
    return bcrypt.compare(password, storedPassword);
  }

  private encryptionKey() {
    const source =
      this.config.get<string>('TWO_FACTOR_ENCRYPTION_KEY') ??
      this.config.get<string>('JWT_SECRET') ??
      'LocalTeleHealth2FAKey2026';
    return createHash('sha256').update(source).digest();
  }

  private encryptSecret(secret: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    return [
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decryptSecret(value: string) {
    try {
      const [iv, tag, encrypted] = value.split('.');
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey(),
        Buffer.from(iv, 'base64url'),
      );
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new UnauthorizedException('Khóa xác thực hai lớp không hợp lệ.');
    }
  }
}
