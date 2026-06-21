import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';

@Injectable()
export class PrescriptionsService {
  // Tiêm PrismaService vào để quẹt database Docker
  constructor(private readonly prisma: PrismaService) {}

  // 1. Logic tạo đơn thuốc mới lưu xuống MySQL Docker
  async create(createPrescriptionDto: CreatePrescriptionDto) {
    const { appointmentId, diagnosis, medicines } = createPrescriptionDto;

    // Kiểm tra xem lịch hẹn (Appointment) này có tồn tại thật không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException('Không tìm thấy lịch hẹn hợp lệ để kê đơn thuốc bạn ơi!');
    }

    // Tiến hành tạo đơn thuốc lưu vào DB
    const prescription = await this.prisma.prescription.create({
      data: {
        appointmentId,
        diagnosis,
        medicines,
      },
    });

    return {
      message: "Kê đơn thuốc điện tử thành công rực rỡ!",
      data: prescription,
    };
  }

  // 2. Logic lấy danh sách toàn bộ đơn thuốc kèm thông tin lịch hẹn liên quan
  async findAll() {
    const prescriptions = await this.prisma.prescription.findMany({
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
      message: "Lấy danh sách đơn thuốc thành công!",
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