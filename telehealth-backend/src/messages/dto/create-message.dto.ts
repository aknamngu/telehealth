export class CreateMessageDto {
  appointmentId!: number;
  senderId!: number;
  messageType!: string; // 'TEXT', 'IMAGE', 'FILE'
  content!: string;
}