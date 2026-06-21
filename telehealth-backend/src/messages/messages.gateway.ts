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

// Mở cổng Gateway cho phép mọi nguồn (CORS) kết nối vào để chat
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly messagesService: MessagesService) {}

  // Khi có ai đó kết nối vào phòng chat
  handleConnection(client: Socket) {
    console.log(`🔌 Thiết bị vừa kết nối Socket: ${client.id}`);
  }

  // Khi có ai đó ngắt kết nối
  handleDisconnect(client: Socket) {
    console.log(`❌ Thiết bị đã ngắt kết nối Socket: ${client.id}`);
  }

  // Người dùng tham gia vào phòng khám cụ thể (Join Room theo appointmentId)
  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody('appointmentId') appointmentId: number,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`room_${appointmentId}`);
    console.log(`👤 Socket ${client.id} đã tham gia vào phòng khám #${appointmentId}`);
    return { status: 'SUCCESS', message: `Đã vào phòng room_${appointmentId}` };
  }

  // Lắng nghe event 'sendMessage' từ Frontend gửi lên
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto,
    @ConnectedSocket() client: Socket,
  ) {
    // 1. Lưu tin nhắn vào MySQL Docker thông qua Service đã có sẵn
    const savedMessage = await this.messagesService.create(createMessageDto);

    // 2. Bắn tin nhắn real-time tới TẤT CẢ mọi người đang ở trong phòng khám đó (bao gồm cả Bác sĩ & Bệnh nhân)
    this.server.to(`room_${createMessageDto.appointmentId}`).emit('newMessage', savedMessage.data);

    return savedMessage;
  }
}