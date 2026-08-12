import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateVitalSignDto, type VitalSignSource } from './dto/create-vital-sign.dto';
import { UpdateVitalSignDto } from './dto/update-vital-sign.dto';

const SOURCES: VitalSignSource[] = ['MANUAL', 'BLUETOOTH', 'SIMULATED'];

@Injectable()
export class VitalSignsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertRange(value: number | undefined, min: number, max: number, label: string) {
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) {
      throw new BadRequestException(`${label} phải nằm trong khoảng ${min}–${max}.`);
    }
  }

  async create(dto: CreateVitalSignDto, user: { sub: number; role: string }) {
    const appointmentId = Number(dto.appointmentId);
    if (!Number.isInteger(appointmentId) || appointmentId < 1) {
      throw new BadRequestException('Mã cuộc hẹn không hợp lệ.');
    }

    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new BadRequestException('Không tìm thấy cuộc hẹn để lưu chỉ số.');

    if (user.role === 'PATIENT' && appointment.patientId !== user.sub) {
      throw new ForbiddenException('Bệnh nhân chỉ được lưu chỉ số cho lịch hẹn của mình.');
    }
    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ được lưu chỉ số cho lịch hẹn của mình.');
    }

    const source: VitalSignSource = dto.source ?? 'MANUAL';
    if (!SOURCES.includes(source)) throw new BadRequestException('Nguồn chỉ số không hợp lệ.');

    const values = [
      dto.heartRate, dto.respiratoryRate, dto.oxygenSaturation,
      dto.systolicPressure, dto.diastolicPressure,
    ];
    if (!values.some((value) => value !== undefined)) {
      throw new BadRequestException('Cần nhập ít nhất một chỉ số sinh tồn.');
    }

    this.assertRange(dto.heartRate, 20, 250, 'Nhịp tim');
    this.assertRange(dto.respiratoryRate, 5, 80, 'Nhịp thở');
    this.assertRange(dto.oxygenSaturation, 50, 100, 'SpO₂');
    this.assertRange(dto.systolicPressure, 50, 260, 'Huyết áp tâm thu');
    this.assertRange(dto.diastolicPressure, 30, 180, 'Huyết áp tâm trương');
    if (
      dto.systolicPressure !== undefined &&
      dto.diastolicPressure !== undefined &&
      dto.diastolicPressure >= dto.systolicPressure
    ) {
      throw new BadRequestException('Huyết áp tâm trương phải thấp hơn huyết áp tâm thu.');
    }

    const vitalSign = await this.prisma.vitalSignsAI.create({
      data: {
        appointmentId,
        heartRate: dto.heartRate,
        respiratoryRate: dto.respiratoryRate,
        oxygenSaturation: dto.oxygenSaturation,
        systolicPressure: dto.systolicPressure,
        diastolicPressure: dto.diastolicPressure,
        source,
        deviceName: dto.deviceName?.trim().slice(0, 191) || null,
        measuredByUserId: user.sub,
        notes: dto.notes?.trim().slice(0, 500) || null,
      },
    });

    return {
      message: source === 'BLUETOOTH'
        ? 'Đã lưu chỉ số từ thiết bị Bluetooth.'
        : source === 'SIMULATED'
          ? 'Đã lưu dữ liệu mô phỏng (không dùng cho chẩn đoán).'
          : 'Đã lưu chỉ số do người dùng nhập.',
      data: vitalSign,
    };
  }

  async findByAppointment(appointmentId: number, user: { sub: number; role: string }) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new BadRequestException('Không tìm thấy cuộc hẹn để tải chỉ số.');
    if (user.role === 'PATIENT' && appointment.patientId !== user.sub) {
      throw new ForbiddenException('Bạn chỉ có thể xem chỉ số của chính mình.');
    }
    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ có thể xem chỉ số của lịch hẹn của mình.');
    }
    return {
      message: `Đã tải chỉ số sinh tồn của cuộc hẹn #${appointmentId}.`,
      data: await this.prisma.vitalSignsAI.findMany({
        where: { appointmentId },
        orderBy: { measuredAt: 'asc' },
      }),
    };
  }

  findAll() { return 'This action returns all vitalSigns'; }
  findOne(id: number) { return `This action returns a #${id} vitalSign`; }
  update(id: number, updateVitalSignDto: UpdateVitalSignDto) {
    void updateVitalSignDto;
    return `This action updates a #${id} vitalSign`;
  }
  remove(id: number) { return `This action removes a #${id} vitalSign`; }
}
