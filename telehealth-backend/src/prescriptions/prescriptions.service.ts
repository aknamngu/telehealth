import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import {
  createPrescriptionVerification,
  verifyPrescriptionIntegrity,
} from './prescription-verification';

@Injectable()
export class PrescriptionsService implements OnModuleInit {
  // Tiêm PrismaService vào để quẹt database Docker
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get signingSecret() {
    return (
      this.config.get<string>('PRESCRIPTION_SIGNING_KEY') ??
      this.config.get<string>('JWT_SECRET') ??
      'telehealth-local-prescription-key'
    );
  }

  // Cấp mã cho dữ liệu mẫu/đơn cũ ngay sau khi thêm cột xác minh.
  async onModuleInit() {
    const unsigned = await this.prisma.prescription.findMany({
      where: { verificationToken: null },
      include: { appointment: true },
    });

    for (const prescription of unsigned) {
      const verification = createPrescriptionVerification(
        {
          appointmentId: prescription.appointmentId,
          doctorId: prescription.appointment.doctorId,
          patientId: prescription.appointment.patientId,
          diagnosis: prescription.diagnosis,
          medicines: prescription.medicines,
        },
        this.signingSecret,
      );
      await this.prisma.prescription.update({
        where: { id: prescription.id },
        data: verification,
      });
    }
  }

  // 1. Logic tạo đơn thuốc mới lưu xuống MySQL Docker
  async create(
    createPrescriptionDto: CreatePrescriptionDto,
    user: { sub: number; role: string },
  ) {
    const { appointmentId, diagnosis, medicines } = createPrescriptionDto;

    // Kiểm tra xem lịch hẹn (Appointment) này có tồn tại thật không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException(
        'Không tìm thấy lịch hẹn hợp lệ để kê đơn thuốc bạn ơi!',
      );
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException(
        'Bác sĩ chỉ có thể kê đơn cho lịch hẹn của chính mình!',
      );
    }

    if (user.role === 'PATIENT') {
      throw new ForbiddenException('Bệnh nhân không có quyền kê đơn thuốc!');
    }

    // Tiến hành tạo đơn thuốc lưu vào DB
    const prescription = await this.prisma.prescription.create({
      data: {
        appointmentId,
        diagnosis,
        medicines,
        ...createPrescriptionVerification(
          {
            appointmentId,
            doctorId: appointment.doctorId,
            patientId: appointment.patientId,
            diagnosis,
            medicines,
          },
          this.signingSecret,
        ),
      },
    });

    return {
      message: 'Kê đơn thuốc điện tử thành công rực rỡ!',
      data: prescription,
    };
  }

  async verify(token: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { verificationToken: token },
      include: {
        appointment: {
          include: {
            patient: { select: { fullName: true } },
            doctor: {
              select: {
                fullName: true,
                doctorProfile: { select: { specialty: true } },
              },
            },
          },
        },
      },
    });

    if (
      !prescription ||
      !prescription.verificationToken ||
      !prescription.verificationHash
    ) {
      throw new NotFoundException(
        'Không tìm thấy mã xác minh đơn thuốc hợp lệ.',
      );
    }

    const intact = verifyPrescriptionIntegrity(
      {
        appointmentId: prescription.appointmentId,
        doctorId: prescription.appointment.doctorId,
        patientId: prescription.appointment.patientId,
        diagnosis: prescription.diagnosis,
        medicines: prescription.medicines,
        verificationToken: prescription.verificationToken,
        issuedAt: prescription.issuedAt,
      },
      prescription.verificationHash,
      this.signingSecret,
    );

    const status = prescription.revokedAt
      ? 'REVOKED'
      : intact
        ? 'VALID'
        : 'TAMPERED';

    return {
      message:
        status === 'VALID'
          ? 'Đơn thuốc điện tử hợp lệ.'
          : 'Đơn thuốc không còn hợp lệ.',
      data: {
        status,
        prescriptionId: prescription.id,
        verificationCode: prescription.verificationToken
          .slice(0, 12)
          .toUpperCase(),
        diagnosis: prescription.diagnosis,
        medicines: prescription.medicines,
        issuedAt: prescription.issuedAt,
        revokedAt: prescription.revokedAt,
        appointmentDate: prescription.appointment.appointmentDate,
        patientName: prescription.appointment.patient.fullName,
        doctorName: prescription.appointment.doctor.fullName,
        specialty:
          prescription.appointment.doctor.doctorProfile?.specialty ?? null,
        signature: prescription.verificationHash,
      },
    };
  }

  async revoke(id: number, user: { sub: number; role: string }) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: { appointment: true },
    });
    if (!prescription) throw new NotFoundException('Không tìm thấy đơn thuốc.');
    if (
      user.role === 'DOCTOR' &&
      prescription.appointment.doctorId !== user.sub
    ) {
      throw new ForbiddenException(
        'Bác sĩ chỉ có thể thu hồi đơn thuốc do mình kê.',
      );
    }
    if (prescription.revokedAt) {
      throw new BadRequestException('Đơn thuốc này đã được thu hồi trước đó.');
    }

    return {
      message: 'Đã thu hồi đơn thuốc điện tử.',
      data: await this.prisma.prescription.update({
        where: { id },
        data: { revokedAt: new Date() },
      }),
    };
  }

  // 2. Logic lấy danh sách toàn bộ đơn thuốc kèm thông tin lịch hẹn liên quan
  async findAll(user: { sub: number; role: string }) {
    const where =
      user.role === 'ADMIN'
        ? undefined
        : user.role === 'DOCTOR'
          ? { appointment: { is: { doctorId: user.sub } } }
          : { appointment: { is: { patientId: user.sub } } };

    const prescriptions = await this.prisma.prescription.findMany({
      where,
      include: {
        appointment: {
          include: {
            patient: { select: { fullName: true, email: true } },
            doctor: { select: { fullName: true } },
          },
        },
      },
    });

    return {
      message: 'Lấy danh sách đơn thuốc thành công!',
      data: prescriptions,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} prescription`;
  }

  update(id: number, updatePrescriptionDto: UpdatePrescriptionDto) {
    return `This action updates a #${id} prescription`;
  }

  remove(id: number) {
    return `This action removes a #${id} prescription`;
  }
}
