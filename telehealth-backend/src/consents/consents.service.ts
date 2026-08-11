import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export const CURRENT_POLICY_VERSION = '2026-08-11';

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireParticipant(appointmentId: number, userId: number) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, patientId: true, doctorId: true },
    });
    if (!appointment) throw new NotFoundException('Không tìm thấy lịch hẹn.');
    if (appointment.patientId !== userId && appointment.doctorId !== userId) {
      throw new ForbiddenException('Bạn không thuộc buổi tư vấn này.');
    }
    return appointment;
  }

  async getMyConsent(appointmentId: number, userId: number) {
    await this.requireParticipant(appointmentId, userId);
    const consent = await this.prisma.consultationConsent.findUnique({
      where: { appointmentId_userId: { appointmentId, userId } },
    });
    return {
      data: {
        accepted: consent?.policyVersion === CURRENT_POLICY_VERSION,
        acceptedAt: consent?.acceptedAt ?? null,
        policyVersion: CURRENT_POLICY_VERSION,
      },
    };
  }

  async accept(
    appointmentId: number,
    userId: number,
    body: { consentAccepted?: boolean; policyVersion?: string },
  ) {
    if (
      !body.consentAccepted ||
      body.policyVersion !== CURRENT_POLICY_VERSION
    ) {
      throw new BadRequestException(
        'Bạn phải đọc và đồng ý chính sách hiện hành.',
      );
    }
    await this.requireParticipant(appointmentId, userId);
    const consent = await this.prisma.consultationConsent.upsert({
      where: { appointmentId_userId: { appointmentId, userId } },
      update: { policyVersion: CURRENT_POLICY_VERSION, acceptedAt: new Date() },
      create: { appointmentId, userId, policyVersion: CURRENT_POLICY_VERSION },
    });
    return { message: 'Đã ghi nhận đồng ý cho buổi tư vấn.', data: consent };
  }
}
