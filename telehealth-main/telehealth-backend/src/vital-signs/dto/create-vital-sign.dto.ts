export class CreateVitalSignDto {
  appointmentId!: number;
  heartRate?: number;          // Nhịp tim (Float)
  respiratoryRate?: number;    // Nhịp thở (Float)
  oxygenSaturation?: number;   // SpO2 (%) (Float)
}