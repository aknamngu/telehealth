import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateVitalSignDto } from './dto/create-vital-sign.dto';
import { UpdateVitalSignDto } from './dto/update-vital-sign.dto';

@Injectable()
export class VitalSignsService {
  // Tiêm PrismaService vào để thao tác với MySQL Docker
  constructor(private readonly prisma: PrismaService) {}

  // 1. Logic lưu chỉ số sinh tồn AI quét từ Camera xuống bảng VitalSignsAI
  async create(createVitalSignDto: CreateVitalSignDto) {
    const { appointmentId, heartRate, respiratoryRate, oxygenSaturation } = createVitalSignDto;

    // Kiểm tra xem cuộc hẹn (Appointment) có tồn tại thật không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException('Không tìm thấy cuộc hẹn hợp lệ để lưu chỉ số sinh tồn bạn ơi!');
    }

    // Lưu thẳng vào bảng vitalSignsAI theo chuẩn Schema của bạn
    const vitalSign = await this.prisma.vitalSignsAI.create({
      data: {
        appointmentId,
        heartRate,
        respiratoryRate,
        oxygenSaturation,
      },
    });

    return {
      message: "Lưu chỉ số sinh tồn từ AI Camera thành công rực rỡ!",
      data: vitalSign,
    };
  }

  // 2. Lấy danh sách chỉ số sinh tồn của một cuộc hẹn (để Frontend vẽ biểu đồ nhịp tim thời gian thực)
  async findByAppointment(appointmentId: number) {
    const signs = await this.prisma.vitalSignsAI.findMany({
      where: { appointmentId },
      orderBy: { measuredAt: 'asc' }, // Sắp xếp thời gian tăng dần để vẽ đồ thị đường thẳng cực mượt
    });

    return {
      message: `Tải danh sách chỉ số sinh tồn của cuộc hẹn #${appointmentId} thành công!`,
      data: signs,
    };
  }

  findAll() {
    return `This action returns all vitalSigns`;
  }

  findOne(id: number) {
    return `This action returns a #${id} vitalSign`;
  }

  update(id: number, updateVitalSignDto: UpdateVitalSignDto) {
    return `This action updates a #${id} vitalSign`;
  }

  remove(id: number) {
    return `This action removes a #${id} vitalSign`;
  }
}