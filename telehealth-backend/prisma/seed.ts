import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

function normalizeDatabaseUrl(databaseUrl: string) {
  if (databaseUrl.includes('allowPublicKeyRetrieval=')) {
    return databaseUrl;
  }

  const separator = databaseUrl.includes('?') ? '&' : '?';
  return `${databaseUrl}${separator}allowPublicKeyRetrieval=true&useSSL=false`;
}

const adapter = new PrismaMariaDb(normalizeDatabaseUrl(process.env.DATABASE_URL!));
const prisma = new PrismaClient({ adapter });

const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

async function resetSeedTables() {
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');
  await prisma.$executeRawUnsafe('DELETE FROM AiConsultationSummary;');
  await prisma.$executeRawUnsafe('DELETE FROM VitalSignsAI;');
  await prisma.$executeRawUnsafe('DELETE FROM MessageLog;');
  await prisma.$executeRawUnsafe('DELETE FROM CallLog;');
  await prisma.$executeRawUnsafe('DELETE FROM Prescription;');
  await prisma.$executeRawUnsafe('DELETE FROM Appointment;');
  await prisma.$executeRawUnsafe('DELETE FROM DoctorProfile;');
  await prisma.$executeRawUnsafe('DELETE FROM doctors;');
  await prisma.$executeRawUnsafe('DELETE FROM User;');
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
}

async function main() {
  await resetSeedTables();

  await prisma.user.create({
    data: {
      email: 'admin@telehealth.vn',
      password: 'admin123',
      fullName: 'Quản trị hệ thống',
      role: 'ADMIN',
    },
  });

  const doctors = [] as Array<{ id: number; email: string; fullName: string; role: string }>;
  for (const doctorData of [
    {
      email: 'son.dang@example.com',
      password: 'password123',
      fullName: 'BS. CKI Đặng Huỳnh Diễm Kiều',
      role: 'DOCTOR',
    },
    {
      email: 'phuong.tran@example.com',
      password: 'password123',
      fullName: 'ThS. BS Trần Lê Uyên Phương',
      role: 'DOCTOR',
    },
    {
      email: 'hien.nguyen@example.com',
      password: 'password123',
      fullName: 'BS. Hoàng Hồng Minh Anh',
      role: 'DOCTOR',
    },
    {
      email: 'quang.le@example.com',
      password: 'password123',
      fullName: 'BS. Nguyễn Minh Tâm',
      role: 'DOCTOR',
    },
  ]) {
    doctors.push(await prisma.user.create({ data: doctorData }));
  }

  const patients = [] as Array<{ id: number; email: string; fullName: string; role: string }>;
  for (const patientData of [
    {
      email: 'patient.an@example.com',
      password: 'password123',
      fullName: 'Nguyễn Minh Thư',
      role: 'PATIENT',
    },
    {
      email: 'patient.linh@example.com',
      password: 'password123',
      fullName: 'Huỳnh Nguyễn Anh Thy',
      role: 'PATIENT',
    },
    {
      email: 'patient.hoa@example.com',
      password: 'password123',
      fullName: 'Trần Hà Vy',
      role: 'PATIENT',
    },
    {
      email: 'patient.tam@example.com',
      password: 'password123',
      fullName: 'Nguyễn Thị Khánh Uyên',
      role: 'PATIENT',
    },
    {
      email: 'patient.ngoc@example.com',
      password: 'password123',
      fullName: 'Nguyễn Ngọc yến Nhi',
      role: 'PATIENT',
    },
    {
      email: 'patient.khoa@example.com',
      password: 'password123',
      fullName: 'Đỗ Quốc Khoa',
      role: 'PATIENT',
    },
  ]) {
    patients.push(await prisma.user.create({ data: patientData }));
  }

  await prisma.doctorProfile.createMany({
    data: [
      {
        userId: doctors[0].id,
        specialty: 'Tim mạch & Cấp cứu AI',
        experienceYears: 10,
        bio: 'Chuyên sâu về tim mạch, teletriage và giám sát sinh tồn theo thời gian thực.',
      },
      {
        userId: doctors[1].id,
        specialty: 'Nội tổng quát & Telehealth',
        experienceYears: 8,
        bio: 'Phát triển quy trình chăm sóc từ xa, hồ sơ điện tử và điều trị đa bệnh lý.',
      },
      {
        userId: doctors[2].id,
        specialty: 'Nhi khoa & Dinh dưỡng',
        experienceYears: 6,
        bio: 'Tối ưu chăm sóc trẻ em, tư vấn dinh dưỡng và theo dõi phát triển hằng tuần.',
      },
      {
        userId: doctors[3].id,
        specialty: 'Da liễu & Khám từ xa',
        experienceYears: 9,
        bio: 'Xử lý các ca bệnh da liễu, đọc ảnh lâm sàng và hỗ trợ kê đơn chính xác.',
      },
    ],
  });

  await prisma.doctor.createMany({
    data: [
      {
        name: 'BS. CKI Đặng Huỳnh Diễm Kiều',
        specialty: 'Chuyên khoa Tim mạch & Cấp cứu AI',
        bio: '10 năm kinh nghiệm, chuyên gia xử lý tích hợp dữ liệu AI và nhịp tim sinh tồn.',
        featured: true,
        sortOrder: 1,
        rating: 4.9,
        patientCount: 10500,
        yearsExp: 10,
        isOnline: true,
      },
      {
        name: 'ThS. BS Trần Lê Uyên Phương',
        specialty: 'Chuyên khoa Nội tổng quát & Chăm sóc từ xa',
        bio: '8 năm kinh nghiệm điều trị lâm sàng, quản lý bệnh án điện tử và telehealth.',
        featured: true,
        sortOrder: 2,
        rating: 4.8,
        patientCount: 8200,
        yearsExp: 8,
        isOnline: true,
      },
      {
        name: 'BS. Hoàng Hồng Minh Anh',
        specialty: 'Chuyên khoa Nhi & Dinh dưỡng',
        bio: 'Tư vấn trẻ em, theo dõi biểu đồ phát triển và chăm sóc dự phòng.',
        featured: true,
        sortOrder: 3,
        rating: 4.7,
        patientCount: 5100,
        yearsExp: 6,
        isOnline: false,
      },
      {
        name: 'BS. Nguyễn Minh Tâm',
        specialty: 'Da liễu & Khám từ xa',
        bio: 'Chuyên đọc ảnh lâm sàng, điều trị da liễu và tư vấn follow-up online.',
        featured: false,
        sortOrder: 4,
        rating: 4.9,
        patientCount: 6800,
        yearsExp: 9,
        isOnline: true,
      },
    ],
  });

  const appointments = [] as Array<{ id: number; patientId: number; doctorId: number; appointmentDate: Date; startTime: string; endTime: string; status: string }>;
  for (const appointmentData of [
    {
      patientId: patients[0].id,
      doctorId: doctors[0].id,
      appointmentDate: daysAgo(10),
      startTime: '08:30',
      endTime: '09:00',
      status: 'COMPLETED',
    },
    {
      patientId: patients[1].id,
      doctorId: doctors[1].id,
      appointmentDate: daysAgo(8),
      startTime: '09:00',
      endTime: '09:30',
      status: 'COMPLETED',
    },
    {
      patientId: patients[2].id,
      doctorId: doctors[2].id,
      appointmentDate: daysAgo(6),
      startTime: '10:00',
      endTime: '10:30',
      status: 'COMPLETED',
    },
    {
      patientId: patients[3].id,
      doctorId: doctors[3].id,
      appointmentDate: daysAgo(3),
      startTime: '13:00',
      endTime: '13:30',
      status: 'CONFIRMED',
    },
    {
      patientId: patients[4].id,
      doctorId: doctors[0].id,
      appointmentDate: daysAgo(1),
      startTime: '15:00',
      endTime: '15:30',
      status: 'COMPLETED',
    },
    {
      patientId: patients[5].id,
      doctorId: doctors[1].id,
      appointmentDate: daysFromNow(1),
      startTime: '09:30',
      endTime: '10:00',
      status: 'PENDING',
    },
    {
      patientId: patients[0].id,
      doctorId: doctors[3].id,
      appointmentDate: daysFromNow(2),
      startTime: '14:00',
      endTime: '14:30',
      status: 'CONFIRMED',
    },
    {
      patientId: patients[1].id,
      doctorId: doctors[2].id,
      appointmentDate: daysFromNow(4),
      startTime: '16:00',
      endTime: '16:30',
      status: 'PENDING',
    },
  ]) {
    appointments.push(await prisma.appointment.create({ data: appointmentData }));
  }

  await prisma.prescription.createMany({
    data: [
      {
        appointmentId: appointments[0].id,
        diagnosis: 'Rối loạn nhịp tim nhẹ, căng thẳng thần kinh.',
        medicines: 'Metoprolol 25mg, Magnesium B6, nghỉ ngơi, theo dõi huyết áp 7 ngày.',
      },
      {
        appointmentId: appointments[1].id,
        diagnosis: 'Viêm họng cấp, sốt nhẹ, ho khan.',
        medicines: 'Paracetamol, nước ấm, súc họng, tái khám sau 3 ngày.',
      },
      {
        appointmentId: appointments[2].id,
        diagnosis: 'Theo dõi dinh dưỡng trẻ em, cân nặng thấp hơn chuẩn.',
        medicines: 'Bổ sung vi chất, tăng bữa phụ, hẹn tái khám sau 2 tuần.',
      },
      {
        appointmentId: appointments[4].id,
        diagnosis: 'Dị ứng da mức độ nhẹ do thời tiết.',
        medicines: 'Kem bôi dưỡng ẩm, kháng histamine nhẹ, tránh kích ứng.',
      },
    ],
  });

  await prisma.callLog.createMany({
    data: [
      {
        appointmentId: appointments[0].id,
        roomName: 'room-cardiology-001',
        duration: 1260,
        recordingUrl: 'https://cdn.telehealth.local/recordings/001.mp4',
        disconnectReason: 'USER_HANGUP',
      },
      {
        appointmentId: appointments[1].id,
        roomName: 'room-internal-002',
        duration: 980,
        recordingUrl: 'https://cdn.telehealth.local/recordings/002.mp4',
        disconnectReason: 'NETWORK_DROP',
      },
      {
        appointmentId: appointments[2].id,
        roomName: 'room-pediatrics-003',
        duration: 1440,
        recordingUrl: 'https://cdn.telehealth.local/recordings/003.mp4',
        disconnectReason: 'USER_HANGUP',
      },
      {
        appointmentId: appointments[4].id,
        roomName: 'room-derma-004',
        duration: 1120,
        recordingUrl: 'https://cdn.telehealth.local/recordings/004.mp4',
        disconnectReason: 'USER_HANGUP',
      },
    ],
  });

  await prisma.messageLog.createMany({
    data: [
      {
        appointmentId: appointments[0].id,
        senderId: patients[0].id,
        messageType: 'TEXT',
        content: 'Bác sĩ ơi, dạo này em hay mệt sau khi vận động nhẹ.',
      },
      {
        appointmentId: appointments[0].id,
        senderId: doctors[0].id,
        messageType: 'TEXT',
        content: 'Mình sẽ kiểm tra nhịp tim và nhắc theo dõi huyết áp nhé.',
      },
      {
        appointmentId: appointments[1].id,
        senderId: patients[1].id,
        messageType: 'TEXT',
        content: 'Em bị sốt nhẹ và đau họng từ tối qua.',
      },
      {
        appointmentId: appointments[1].id,
        senderId: doctors[1].id,
        messageType: 'TEXT',
        content: 'Uống nhiều nước ấm, nghỉ ngơi và theo dõi nhiệt độ mỗi 4 giờ.',
      },
      {
        appointmentId: appointments[2].id,
        senderId: patients[2].id,
        messageType: 'TEXT',
        content: 'Bé nhà em ăn ít và chậm tăng cân.',
      },
      {
        appointmentId: appointments[2].id,
        senderId: doctors[2].id,
        messageType: 'TEXT',
        content: 'Mình điều chỉnh bữa phụ, vi chất và lịch tái khám 2 tuần nữa.',
      },
      {
        appointmentId: appointments[4].id,
        senderId: patients[4].id,
        messageType: 'TEXT',
        content: 'Da em bị ngứa và đỏ sau khi đổi sữa tắm.',
      },
      {
        appointmentId: appointments[4].id,
        senderId: doctors[3].id,
        messageType: 'TEXT',
        content: 'Ngưng sản phẩm mới, dùng dưỡng ẩm và theo dõi phản ứng.',
      },
    ],
  });

  await prisma.vitalSignsAI.createMany({
    data: [
      {
        appointmentId: appointments[0].id,
        heartRate: 92,
        respiratoryRate: 18,
        oxygenSaturation: 98,
      },
      {
        appointmentId: appointments[0].id,
        heartRate: 88,
        respiratoryRate: 17,
        oxygenSaturation: 99,
      },
      {
        appointmentId: appointments[1].id,
        heartRate: 84,
        respiratoryRate: 16,
        oxygenSaturation: 99,
      },
      {
        appointmentId: appointments[2].id,
        heartRate: 96,
        respiratoryRate: 20,
        oxygenSaturation: 97,
      },
      {
        appointmentId: appointments[4].id,
        heartRate: 87,
        respiratoryRate: 18,
        oxygenSaturation: 98,
      },
      {
        appointmentId: appointments[4].id,
        heartRate: 85,
        respiratoryRate: 17,
        oxygenSaturation: 99,
      },
    ],
  });

  await prisma.aiConsultationSummary.createMany({
    data: [
      {
        appointmentId: appointments[0].id,
        rawTranscript: 'Bệnh nhân than mệt khi gắng sức, bác sĩ khai thác tiền sử tim mạch và stress gần đây.',
        aiSummary: 'Theo dõi tim mạch, đo huyết áp tại nhà, giảm căng thẳng và tái khám khi có dấu hiệu bất thường.',
        suggestedMedicines: 'Metoprolol 25mg nếu cần, bổ sung magnesium, nghỉ ngơi.',
      },
      {
        appointmentId: appointments[1].id,
        rawTranscript: 'Bệnh nhân sốt nhẹ, đau họng, ho khan và ngủ kém.',
        aiSummary: 'Nghi viêm họng cấp, điều trị triệu chứng và tái khám nếu sốt kéo dài.',
        suggestedMedicines: 'Paracetamol, nước ấm, súc họng.',
      },
      {
        appointmentId: appointments[2].id,
        rawTranscript: 'Phụ huynh báo trẻ ăn ít, biếng ăn và tăng cân chậm.',
        aiSummary: 'Tăng cường vi chất, phân bổ bữa phụ và đánh giá tăng trưởng lại sau 2 tuần.',
        suggestedMedicines: 'Vitamin tổng hợp, hướng dẫn dinh dưỡng.',
      },
      {
        appointmentId: appointments[4].id,
        rawTranscript: 'Bệnh nhân ngứa đỏ da sau khi đổi sản phẩm chăm sóc cá nhân.',
        aiSummary: 'Dị ứng da mức độ nhẹ, ngưng sản phẩm mới và chăm sóc hàng rào da.',
        suggestedMedicines: 'Kem dưỡng ẩm, thuốc kháng histamine nếu ngứa nhiều.',
      },
    ],
  });

  console.log('🌱 Seed full-stack telehealth data đã nạp xong: users, doctors, appointments, prescriptions, messages, vital signs, call logs, AI summaries.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
