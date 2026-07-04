export class CreateUserDto {
  email!: string;
  password!: string;
  fullName!: string;
  role!: string; // 'PATIENT' hoặc 'DOCTOR'
}