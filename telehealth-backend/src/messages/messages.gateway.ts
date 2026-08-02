import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../prisma.service';

interface ActiveCall {
  doctorId: number;
  appointmentId: string;
  patientName: string;
  isEmergency?: boolean;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  maxHttpBufferSize: 1e7, // Cho phép 10MB data (để gửi base64 hình ảnh)
})
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  // Quản lý trạng thái các cuộc gọi đang diễn ra để chặn trùng / báo bận
  private activeCalls = new Map<string, ActiveCall>();
  // Theo dõi socket nào đang ở appointment nào (để cleanup khi disconnect)
  private socketToAppointment = new Map<string, string>();

  constructor(
    private readonly messagesService: MessagesService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`🔌 Thiết bị vừa kết nối Socket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Thiết bị đã ngắt kết nối Socket: ${client.id}`);
    // Dọn dẹp activeCall nếu socket này đang trong cuộc gọi
    const appointmentId = this.socketToAppointment.get(client.id);
    if (appointmentId && this.activeCalls.has(appointmentId)) {
      console.log(`🧹 Dọn dẹp activeCall cho appointment ${appointmentId} do socket ${client.id} ngắt kết nối`);
      this.activeCalls.delete(appointmentId);
      this.socketToAppointment.delete(client.id);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto & { senderId: number; senderRole: string },
    @ConnectedSocket() client: Socket,
  ) {
    const mockUserFromToken = {
      sub: createMessageDto.senderId,
      role: createMessageDto.senderRole || 'PATIENT',
    };

    const savedMessage = await this.messagesService.create(createMessageDto, mockUserFromToken);
    this.server.to(`room_${createMessageDto.appointmentId}`).emit('newMessage', savedMessage.data);
    return savedMessage;
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() appointmentId: string,
    @ConnectedSocket() client: Socket
  ) {
    const roomName = appointmentId.startsWith('doctor_') ? appointmentId : `room_${appointmentId}`;
    client.join(roomName);
    console.log(`📥 Client ${client.id} joined socket room: ${roomName}`);
  }

  @SubscribeMessage('offer')
  handleOffer(@MessageBody() payload: { offer: any; appointmentId: string }, @ConnectedSocket() client: Socket) {
    client.to(`room_${payload.appointmentId}`).emit('offer', payload.offer);
  }

  @SubscribeMessage('answer')
  handleAnswer(@MessageBody() payload: { answer: any; appointmentId: string }, @ConnectedSocket() client: Socket) {
    client.to(`room_${payload.appointmentId}`).emit('answer', payload.answer);
  }

  @SubscribeMessage('candidate')
  handleCandidate(@MessageBody() payload: { candidate: any; appointmentId: string }, @ConnectedSocket() client: Socket) {
    client.to(`room_${payload.appointmentId}`).emit('candidate', payload.candidate);
  }

  @SubscribeMessage('call:invite')
  handleCallInvite(
    @MessageBody() payload: { appointmentId: string; doctorId?: number; fromName: string; fromRole: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`📩 call:invite from ${client.id}`, payload);

    // Kiểm tra BÁC SĨ BẬN: Nếu bác sĩ đang trong cuộc gọi khác (khác appointmentId)
    if (payload.doctorId) {
      let isDoctorBusy = false;
      let busyAppointmentId = '';

      for (const [appId, activeCall] of this.activeCalls.entries()) {
        if (activeCall.doctorId === payload.doctorId && appId !== payload.appointmentId) {
          isDoctorBusy = true;
          busyAppointmentId = appId;
          break;
        }
      }

      if (isDoctorBusy) {
        console.log(`⚠️ Bác sĩ ${payload.doctorId} đang bận trong ca ${busyAppointmentId}! Báo bận cho client.`);
        client.emit('call:busy', {
          doctorId: payload.doctorId,
          appointmentId: payload.appointmentId,
          message: 'Bác sĩ hiện đang trong phiên tư vấn trực tiếp với bệnh nhân khác. Vui lòng đặt lịch hoặc chờ bác sĩ hoàn thành!',
        });
        return;
      }
    }

    // Nếu không bận: Broadcast tới room cuộc hẹn và room riêng bác sĩ
    client.to(`room_${payload.appointmentId}`).emit('call:invite', payload);

    if (payload.doctorId) {
      const doctorRoom = `doctor_${payload.doctorId}`;
      console.log(`📨 forwarding invite to ${doctorRoom}`);
      client.to(doctorRoom).emit('call:invite', payload);
    }
  }

  @SubscribeMessage('call:accept')
  handleCallAccept(
    @MessageBody() payload: { appointmentId: string; doctorId?: number; fromName?: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`✅ call:accept for appointment ${payload.appointmentId}`);
    
    // Đánh dấu bác sĩ đang bận cuộc gọi
    const docId = payload.doctorId ?? 1;
    this.activeCalls.set(payload.appointmentId, {
      doctorId: docId,
      appointmentId: payload.appointmentId,
      patientName: payload.fromName ?? 'Bệnh nhân',
    });
    // Ghi nhận socket này đang trong appointment
    this.socketToAppointment.set(client.id, payload.appointmentId);

    client.to(`room_${payload.appointmentId}`).emit('call:accept');
  }

  @SubscribeMessage('call:decline')
  handleCallDecline(
    @MessageBody() payload: { appointmentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`room_${payload.appointmentId}`).emit('call:decline');
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @MessageBody() payload: { appointmentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`📴 call:end for appointment ${payload.appointmentId}`);
    this.activeCalls.delete(payload.appointmentId);
    this.socketToAppointment.delete(client.id);
    client.to(`room_${payload.appointmentId}`).emit('call:end');

    // Tự động đánh dấu appointment là COMPLETED khi cuộc gọi kết thúc
    const numericId = parseInt(payload.appointmentId, 10);
    if (!isNaN(numericId)) {
      try {
        await this.prisma.appointment.update({
          where: { id: numericId },
          data: { status: 'COMPLETED' },
        });
        console.log(`✅ Appointment #${numericId} đã tự động chuyển sang COMPLETED sau cuộc gọi`);
      } catch (err) {
        console.error(`⚠️ Không thể auto-complete appointment #${numericId}:`, err);
      }
    }
  }

  // 🚨 HỆ THỐNG CẤP CỨU KHẨN CẤP SOS (EMERGENCY OVERRIDE)
  @SubscribeMessage('call:emergency')
  handleCallEmergency(
    @MessageBody() payload: {
      appointmentId: string;
      doctorId?: number;
      fromName: string;
      emergencyType: string;
      details?: string;
    },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`🚨 BÁO ĐỘNG SOS KHẨN CẤP:`, payload);

    // Đánh dấu ca cấp cứu
    this.activeCalls.set(payload.appointmentId, {
      doctorId: payload.doctorId ?? 1,
      appointmentId: payload.appointmentId,
      patientName: payload.fromName,
      isEmergency: true,
    });

    // Phát tín hiệu CẤP CỨU NGUY CẤP tới TẤT CẢ socket bác sĩ online
    this.server.emit('call:emergency', payload);
  }

  // Bác sĩ bấm "Ưu tiên Cấp cứu" để ngắt ca thường và nhận ca khẩn
  @SubscribeMessage('call:emergency:override')
  handleEmergencyOverride(
    @MessageBody() payload: {
      emergencyAppointmentId: string;
      previousAppointmentId?: string;
      doctorId: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    console.log(`🚨 Bác sĩ ${payload.doctorId} chấp nhận ƯU TIÊN CẤP CỨU ca ${payload.emergencyAppointmentId}`);

    // 1. Nếu bác sĩ đang trong ca thường khác -> Ngắt ca thường và thông báo cho bệnh nhân ca đó
    if (payload.previousAppointmentId) {
      this.activeCalls.delete(payload.previousAppointmentId);
      this.server.to(`room_${payload.previousAppointmentId}`).emit('call:end', {
        reason: 'EMERGENCY_OVERRIDE',
        message: 'Bác sĩ vừa tạm ngắt phiên tư vấn để ứng cứu ca CẤP CỨU KHẨN CẤP. Xin vui lòng chờ ít phút!',
      });
    }

    // 2. Chấp nhận và vào ca cấp cứu SOS
    client.to(`room_${payload.emergencyAppointmentId}`).emit('call:accept');
  }
}
