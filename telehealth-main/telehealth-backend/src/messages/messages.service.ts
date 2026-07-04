import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  // Tiêm PrismaService thần thánh vào
  constructor(private readonly prisma: PrismaService) {}

  // 1. Logic lưu tin nhắn mới chat real-time vào bảng MessageLog
  async create(createMessageDto: CreateMessageDto) {
    const { appointmentId, senderId, messageType, content } = createMessageDto;

    // Kiểm tra xem cuộc hẹn (Appointment) có tồn tại thật không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new BadRequestException('Không tìm thấy cuộc hẹn hợp lệ để lưu tin nhắn!');
    }

    // Kiểm tra người gửi (User) có tồn tại không
    const user = await this.prisma.user.findUnique({
      where: { id: senderId },
    });
    if (!user) {
      throw new BadRequestException('Người gửi không tồn tại trên hệ thống!');
    }

    // Lưu thẳng vào bảng messageLog theo đúng Schema
    const messageLog = await this.prisma.messageLog.create({
      data: {
        appointmentId,
        senderId,
        messageType,
        content,
      },
    });

    return {
      message: "Lưu lịch sử tin nhắn thành công!",
      data: messageLog,
    };
  }

  // 2. Lấy toàn bộ nội dung đoạn chat của 1 cuộc hẹn (để khi load phòng khám hiện lại tin nhắn cũ)
  async findByAppointment(appointmentId: number) {
    const chatHistory = await this.prisma.messageLog.findMany({
      where: { appointmentId },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true }
        }
      },
      orderBy: { createdAt: 'asc' } // Tin nhắn cũ trước, tin nhắn mới sau
    });

    return {
      message: `Tải lịch sử cuộc chat của cuộc hẹn #${appointmentId} thành công!`,
      data: chatHistory,
    };
  }

  findAll() {
    return `This action returns all messages`;
  }

  findOne(id: number) {
    return `This action returns a #${id} message`;
  }

  update(id: number, updateMessageDto: UpdateMessageDto) {
    return `This action updates a #${id} message`;
  }

  remove(id: number) {
    return `This action removes a #${id} message`;
  }
}