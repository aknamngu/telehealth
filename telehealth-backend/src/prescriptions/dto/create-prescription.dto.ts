export class CreatePrescriptionDto {
  appointmentId!: number;
  diagnosis!: string;
  medicines!: string; // Lưu chuỗi text hoặc chuỗi JSON danh sách thuốc
}