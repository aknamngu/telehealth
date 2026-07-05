import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createMessageDto: CreateMessageDto, user: { sub: number; role: string }) {
    const { appointmentId, messageType, content } = createMessageDto;
    const senderId = user.sub;

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new BadRequestException('Không tìm thấy cuộc hẹn hợp lệ để lưu tin nhắn!');
    }

    if (user.role === 'PATIENT' && appointment.patientId !== user.sub) {
      throw new ForbiddenException('Bạn chỉ có thể nhắn trong cuộc hẹn của chính mình!');
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ có thể nhắn trong cuộc hẹn của chính mình!');
    }

    // ĐỔI TÊN BIẾN Ở ĐÂY ĐỂ KHÔNG TRÙNG VỚI THAM SỐ 'user'
    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
    });
    if (!sender) {
      throw new BadRequestException('Người gửi không tồn tại trên hệ thống!');
    }

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
  async findByAppointment(appointmentId: number, user: { sub: number; role: string }) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new BadRequestException('Không tìm thấy cuộc hẹn hợp lệ để tải tin nhắn!');
    }

    if (user.role === 'PATIENT' && appointment.patientId !== user.sub) {
      throw new ForbiddenException('Bạn chỉ có thể xem chat của chính mình!');
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ có thể xem chat của chính mình!');
    }

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