export class CreateCallLogDto {
  appointmentId!: number;
  roomName!: string;
  duration?: number;
  recordingUrl?: string;
  disconnectReason?: string;
}