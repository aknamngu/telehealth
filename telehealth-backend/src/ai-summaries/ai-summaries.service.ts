import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAiSummaryDto } from './dto/create-ai-summary.dto';
import { UpdateAiSummaryDto } from './dto/update-ai-summary.dto';

@Injectable()
export class AiSummariesService {
  // Tiêm PrismaService vào để quẹt database Docker
  constructor(private readonly prisma: PrismaService) {}

  // 1. Logic lưu kết quả tóm tắt của AI xuống bảng AiConsultationSummary
  async create(createAiSummaryDto: CreateAiSummaryDto) {
    const { appointmentId, rawTranscript, aiSummary, suggestedMedicines } = createAiSummaryDto;

    // Kiểm tra xem cuộc hẹn (Appointment) có tồn tại thật không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException('Không tìm thấy cuộc hẹn hợp lệ để lưu tóm tắt AI bạn ơi!');
    }

    // Lưu thẳng vào bảng aiConsultationSummary chuẩn đét theo Schema
    const summary = await this.prisma.aiConsultationSummary.create({
      data: {
        appointmentId,
        rawTranscript,
        aiSummary,
        suggestedMedicines,
      },
    });

    return {
      message: "Lưu dữ liệu tóm tắt từ Trợ lý AI thành công rực rỡ!",
      data: summary,
    };
  }

  // 2. Lấy thông tin tóm tắt AI dựa theo cuộc hẹn
  async findByAppointment(appointmentId: number) {
    const summary = await this.prisma.aiConsultationSummary.findFirst({
      where: { appointmentId },
    });

    return {
      message: `Tải dữ liệu tóm tắt AI của cuộc hẹn #${appointmentId} thành công!`,
      data: summary,
    };
  }

  findAll() {
    return `This action returns all aiSummaries`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiSummary`;
  }

  update(id: number, updateAiSummaryDto: UpdateAiSummaryDto) {
    return `This action updates a #${id} aiSummary`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiSummary`;
  }
}