export type VitalSignSource = 'MANUAL' | 'BLUETOOTH' | 'SIMULATED';

export class CreateVitalSignDto {
  appointmentId!: number;
  heartRate?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  systolicPressure?: number;
  diastolicPressure?: number;
  source?: VitalSignSource;
  deviceName?: string;
  notes?: string;
}
