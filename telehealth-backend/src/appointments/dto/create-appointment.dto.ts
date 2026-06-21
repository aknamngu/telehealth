export class CreateAppointmentDto {
  patientId!: number;
  doctorId!: number;
  appointmentDate!: string; // Định dạng chuỗi ngày (VD: "2026-06-25")
  startTime!: string;       // Giờ bắt đầu (VD: "09:00")
  endTime!: string;         // Giờ kết thúc (VD: "09:30")
  symptoms?: string;
}