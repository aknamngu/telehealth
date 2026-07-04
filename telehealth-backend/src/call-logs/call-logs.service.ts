import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateCallLogDto } from './dto/create-call-log.dto';
import { UpdateCallLogDto } from './dto/update-call-log.dto';

@Injectable()
export class CallLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Logic lưu nhật ký cuộc gọi mới khớp chuẩn Schema của bạn
  async create(createCallLogDto: CreateCallLogDto, user: { sub: number; role: string }) {
    const { appointmentId, roomName, duration, recordingUrl, disconnectReason } = createCallLogDto;

    // Kiểm tra xem lịch hẹn (Appointment) liên quan có tồn tại thật không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException('Không tìm thấy lịch hẹn hợp lệ cho cuộc gọi này bạn ơi!');
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ có thể tạo log cho lịch hẹn của chính mình!');
    }

    if (user.role === 'PATIENT') {
      throw new ForbiddenException('Bệnh nhân không có quyền tạo log cuộc gọi!');
    }

    // Tiến hành tạo log cuộc gọi với các trường chuẩn đét
    const callLog = await this.prisma.callLog.create({
      data: {
        appointmentId,
        roomName,
        duration,
        recordingUrl,
        disconnectReason,
      },
    });

    return {
      message: "Lưu nhật ký cuộc gọi video thành công rực rỡ!",
      data: callLog,
    };
  }

  // 2. Logic lấy danh sách toàn bộ nhật ký cuộc gọi
  async findAll(user: { sub: number; role: string }) {
    const where =
      user.role === 'ADMIN'
        ? undefined
        : user.role === 'DOCTOR'
          ? { appointment: { is: { doctorId: user.sub } } }
          : { appointment: { is: { patientId: user.sub } } };

    const logs = await this.prisma.callLog.findMany({
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
      message: "Lấy danh sách nhật ký cuộc gọi thành công!",
      data: logs,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} callLog`;
  }

  update(id: number, updateCallLogDto: UpdateCallLogDto) {
    return `This action updates a #${id} callLog`;
  }

  remove(id: number) {
    return `This action removes a #${id} callLog`;
  }
}