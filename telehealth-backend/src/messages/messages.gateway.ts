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

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class MessagesGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly messagesService: MessagesService) {}

  handleConnection(client: Socket) {
    console.log(`🔌 Thiết bị vừa kết nối Socket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`❌ Thiết bị đã ngắt kết nối Socket: ${client.id}`);
  }


  @SubscribeMessage('sendMessage')
  async handleMessage(
    @MessageBody() createMessageDto: CreateMessageDto & { senderId: number; senderRole: string }, // Nhận thêm thông tin người gửi từ frontend bọc kèm trong payload
    @ConnectedSocket() client: Socket,
  ) {
    // Trích xuất thông tin user từ payload dto gửi lên để truyền vào Service
    const mockUserFromToken = {
      sub: createMessageDto.senderId,
      role: createMessageDto.senderRole || 'PATIENT',
    };

    // 1. Lưu tin nhắn vào DB, truyền đủ 2 tham số để hết lỗi Expected 2 arguments
    const savedMessage = await this.messagesService.create(createMessageDto, mockUserFromToken);

    // 2. Bắn tin nhắn real-time tới phòng chat
    this.server.to(`room_${createMessageDto.appointmentId}`).emit('newMessage', savedMessage.data);

    return savedMessage;
  }


@SubscribeMessage('answer')
handleAnswer(@MessageBody() payload: { answer: any; appointmentId: string }, @ConnectedSocket() client: Socket) {
  client.to(`room_${payload.appointmentId}`).emit('answer', payload.answer);
}

@SubscribeMessage('candidate')
handleCandidate(@MessageBody() payload: { candidate: any; appointmentId: string }, @ConnectedSocket() client: Socket) {
  client.to(`room_${payload.appointmentId}`).emit('candidate', payload.candidate);
}


@SubscribeMessage('joinRoom')
handleJoinRoom(
  @MessageBody() appointmentId: string, // Nhận ID từ URL hoặc raw doctor_* room
  @ConnectedSocket() client: Socket
) {
  const roomName = appointmentId.startsWith('doctor_') ? appointmentId : `room_${appointmentId}`;
  client.join(roomName);
  console.log(`📥 Client ${client.id} joined socket room: ${roomName}`);
}

// Cập nhật lại các event offer/answer/candidate như sau:
@SubscribeMessage('offer')
handleOffer(@MessageBody() payload: { offer: any, appointmentId: string }, @ConnectedSocket() client: Socket) {
  client.to(`room_${payload.appointmentId}`).emit('offer', payload.offer);
}
@SubscribeMessage('call:invite')
handleCallInvite(
  @MessageBody() payload: { appointmentId: string; doctorId?: number; fromName: string; fromRole: string },
  @ConnectedSocket() client: Socket,
) {
  console.log(`📩 call:invite from ${client.id}`, payload);
  client.to(`room_${payload.appointmentId}`).emit('call:invite', payload);

  if (payload.doctorId) {
    const doctorRoom = `doctor_${payload.doctorId}`;
    console.log(`📨 forwarding invite to ${doctorRoom}`);
    client.to(doctorRoom).emit('call:invite', payload);
  }
}

@SubscribeMessage('call:accept')
handleCallAccept(
  @MessageBody() payload: { appointmentId: string },
  @ConnectedSocket() client: Socket,
) {
  console.log(`✅ call:accept for appointment ${payload.appointmentId}`);
  // Broadcast to everyone in the room (patient will receive this to create offer)
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
handleCallEnd(
  @MessageBody() payload: { appointmentId: string },
  @ConnectedSocket() client: Socket,
) {
  console.log(`📴 call:end for appointment ${payload.appointmentId}`);
  client.to(`room_${payload.appointmentId}`).emit('call:end');
}
}



