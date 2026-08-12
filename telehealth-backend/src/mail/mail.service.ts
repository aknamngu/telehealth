import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

export type OtpDeliveryResult = {
  mode: 'smtp' | 'development';
  devOtp?: string;
};

export type AppointmentEmailDetails = {
  appointmentId: number;
  recipientName: string;
  patientName: string;
  doctorName: string;
  appointmentDate: Date | string;
  startTime: string;
  endTime: string;
  status: string;
  kind: 'BOOKED' | 'STATUS_CHANGED' | 'REMINDER';
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

  isConfigured() {
    return this.transporter !== null;
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

  async sendAppointmentEmail(
    email: string,
    details: AppointmentEmailDetails,
  ): Promise<boolean> {
    if (!this.transporter) {
      if (this.config.get<string>('NODE_ENV') !== 'test') {
        console.log(
          `[DEV APPOINTMENT EMAIL] #${details.appointmentId} ${details.kind} -> ${email}`,
        );
      }
      return false;
    }

    const date = new Date(details.appointmentDate).toLocaleDateString('vi-VN');
    const subjects = {
      BOOKED: `Đã tạo lịch khám #${details.appointmentId}`,
      STATUS_CHANGED: `Lịch khám #${details.appointmentId}: ${details.status}`,
      REMINDER: `Nhắc lịch khám #${details.appointmentId}`,
    };
    const introductions = {
      BOOKED: 'Lịch khám đã được tạo trên hệ thống.',
      STATUS_CHANGED: `Trạng thái lịch khám vừa đổi thành ${details.status}.`,
      REMINDER: 'Lịch khám của bạn sẽ diễn ra trong vòng 24 giờ tới.',
    };

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: email,
        subject: subjects[details.kind],
        text: [
          `Xin chào ${details.recipientName},`,
          introductions[details.kind],
          `Bệnh nhân: ${details.patientName}`,
          `Bác sĩ: ${details.doctorName}`,
          `Thời gian: ${date}, ${details.startTime}–${details.endTime}`,
          `Trạng thái: ${details.status}`,
        ].join('\n'),
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:28px;color:#0f172a">
            <h2 style="color:#0284c7">OS TeleHealth</h2>
            <p>Xin chào <strong>${this.escapeHtml(details.recipientName)}</strong>,</p>
            <p>${this.escapeHtml(introductions[details.kind])}</p>
            <div style="background:#f0f9ff;border-radius:16px;padding:20px;line-height:1.8">
              <div><strong>Mã lịch:</strong> #${details.appointmentId}</div>
              <div><strong>Bệnh nhân:</strong> ${this.escapeHtml(details.patientName)}</div>
              <div><strong>Bác sĩ:</strong> ${this.escapeHtml(details.doctorName)}</div>
              <div><strong>Thời gian:</strong> ${date}, ${this.escapeHtml(details.startTime)}–${this.escapeHtml(details.endTime)}</div>
              <div><strong>Trạng thái:</strong> ${this.escapeHtml(details.status)}</div>
            </div>
            <p style="color:#64748b">Đây là email tự động. Vui lòng không gửi thông tin sức khỏe nhạy cảm qua email.</p>
          </div>
        `,
      });
      return true;
    } catch (error) {
      console.warn(
        `Không thể gửi email lịch khám #${details.appointmentId}:`,
        error instanceof Error ? error.message : 'SMTP error',
      );
      return false;
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
