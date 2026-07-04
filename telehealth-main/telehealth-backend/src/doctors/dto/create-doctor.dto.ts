export class CreateDoctorDto {
  userId!: number;
  specialty!: string;
  experienceYears!: number;
  bio?: string;
}