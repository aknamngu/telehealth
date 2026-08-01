import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { MessagesService } from './messages.service';
import { CreateMessageDto } from './dto/create-message.dto';

type GatewayUser = {
  sub: number;
  email: string;
  role: string;
};

type AuthenticatedSocket = Socket & {
  data: {
    user?: GatewayUser;
  };
};

type PatientSignalPayload = {
  doctorId: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  note?: string;
};

// Mở cổng Gateway cho phép mọi nguồn (CORS) kết nối vào để chat
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  private extractBearerToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim().length > 0) {
      return authToken;
    }

    const headerAuth = client.handshake.headers.authorization;
    if (typeof headerAuth === 'string' && headerAuth.startsWith('Bearer ')) {
      return headerAuth.slice(7);
    }

    return null;
  }

  // Khi có ai đó kết nối vào phòng chat
  async handleConnection(client: AuthenticatedSocket) {
    const token = this.extractBearerToken(client);
    if (!token) {
      client.emit('socketError', { message: 'Thiếu token đăng nhập để kết nối realtime.' });
      client.disconnect(true);
      return;
    }

    try {
      const user = (await this.jwtService.verifyAsync(token)) as GatewayUser;
      client.data.user = user;
      client.join(`user_${user.sub}`);
      console.log(`🔌 User #${user.sub} kết nối Socket: ${client.id}`);
    } catch {
      client.emit('socketError', { message: 'Token realtime không hợp lệ hoặc đã hết hạn.' });
      client.disconnect(true);
    }
  }

  // Khi có ai đó ngắt kết nối
  handleDisconnect(client: AuthenticatedSocket) {
    console.log(`❌ Thiết bị đã ngắt kết nối Socket: ${client.id}`);
  }

  // Người dùng tham gia vào phòng khám cụ thể (Join Room theo appointmentId)
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('appointmentId') appointmentId: number,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!appointmentId || Number.isNaN(appointmentId)) {
      throw new WsException('appointmentId không hợp lệ.');
    }

    client.join(`room_${appointmentId}`);
    console.log(`👤 Socket ${client.id} đã tham gia vào phòng khám #${appointmentId}`);
    return { status: 'SUCCESS', message: `Đã vào phòng room_${appointmentId}` };
  }

  // Lắng nghe event 'sendMessage' từ Frontend gửi lên
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Phiên realtime không hợp lệ, vui lòng đăng nhập lại.');
    }

    // 1. Lưu tin nhắn vào MySQL Docker thông qua Service đã có sẵn
    const savedMessage = await this.messagesService.create(createMessageDto, user);

    // 2. Bắn tin nhắn real-time tới TẤT CẢ mọi người đang ở trong phòng khám đó (bao gồm cả Bác sĩ & Bệnh nhân)
    this.server.to(`room_${createMessageDto.appointmentId}`).emit('newMessage', savedMessage.data);

    return savedMessage;
  }

  @SubscribeMessage('sendPatientSignal')
  handlePatientSignal(
    @MessageBody() payload: PatientSignalPayload,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Phiên realtime không hợp lệ, vui lòng đăng nhập lại.');
    }

    if (user.role !== 'PATIENT') {
      throw new WsException('Chỉ tài khoản bệnh nhân mới được gửi tín hiệu trực tiếp.');
    }

    if (!payload?.doctorId || Number.isNaN(payload.doctorId)) {
      throw new WsException('doctorId không hợp lệ.');
    }

    this.server.to(`user_${payload.doctorId}`).emit('patientSignalReceived', {
      patientId: user.sub,
      patientEmail: user.email,
      heartRate: payload.heartRate ?? null,
      respiratoryRate: payload.respiratoryRate ?? null,
      oxygenSaturation: payload.oxygenSaturation ?? null,
      note: payload.note?.trim() || null,
      sentAt: new Date().toISOString(),
    });

    return { status: 'SUCCESS', message: 'Đã gửi tín hiệu realtime đến bác sĩ.' };
  }
}