export class CreateAppointmentDto {
  patientId!: number;
  doctorId!: number;
  appointmentDate!: string;
  startTime!: string;
  endTime!: string;
  symptoms!: string;
  paymentMethod?: string;
}
