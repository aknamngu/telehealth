import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type OtpDeliveryResult = {
  mode: 'smtp' | 'development';
  devOtp?: string;
};

@Injectable()
export class MailService {
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    this.from =
      this.config.get<string>('EMAIL_FROM') ||
      user ||
      'OS TeleHealth <no-reply@telehealth.local>';

    this.transporter =
      host && user && pass
        ? nodemailer.createTransport({
            host,
            port,
            secure:
              this.config.get<string>('SMTP_SECURE') === 'true' || port === 465,
            auth: { user, pass },
          })
        : null;
  }

  async sendVerificationOtp(
    email: string,
    fullName: string,
    otp: string,
  ): Promise<OtpDeliveryResult> {
    if (!this.transporter) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new ServiceUnavailableException(
          'Máy chủ email chưa được cấu hình.',
        );
      }

      console.log(`[DEV EMAIL OTP] ${email}: ${otp}`);
      return { mode: 'development', devOtp: otp };
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: 'Mã xác minh email OS TeleHealth',
        text: `Xin chào ${fullName}, mã OTP của bạn là ${otp}. Mã có hiệu lực trong 5 phút.`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#0f172a">
            <h2 style="color:#0284c7">OS TeleHealth</h2>
            <p>Xin chào <strong>${this.escapeHtml(fullName)}</strong>,</p>
            <p>Dùng mã bên dưới để xác minh địa chỉ email của bạn:</p>
            <div style="font-size:32px;font-weight:800;letter-spacing:10px;background:#f0f9ff;border-radius:16px;padding:20px;text-align:center;color:#0369a1">${otp}</div>
            <p style="color:#64748b">Mã có hiệu lực trong 5 phút. Không chia sẻ mã này với bất kỳ ai.</p>
          </div>
        `,
      });
      return { mode: 'smtp' };
    } catch {
      throw new ServiceUnavailableException(
        'Không thể gửi email OTP. Vui lòng kiểm tra cấu hình SMTP.',
      );
    }
  }

  private escapeHtml(value: string) {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }
}
