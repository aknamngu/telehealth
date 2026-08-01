export class CreateMessageDto {
  appointmentId!: number;
  messageType!: string; // 'TEXT', 'IMAGE', 'FILE'
  content!: string;
}