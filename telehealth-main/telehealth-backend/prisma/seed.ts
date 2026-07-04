import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import 'dotenv/config';

// Cấu hình adapter giống hệt PrismaService để script seed biết đường chui vào Docker MySQL/MariaDB
const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear sạch dữ liệu cũ tránh trùng lặp
  await prisma.doctor.deleteMany({});

  await prisma.doctor.createMany({
    data: [
      {
        name: 'BS. CKI Đặng Hoàng Sơn',
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
        name: 'BS. Nguyễn Văn A',
        specialty: 'Chuyên khoa Nhi & Dinh dưỡng',
        bio: '5 năm kinh nghiệm chăm sóc sức khỏe toàn diện cho trẻ nhỏ.',
        featured: false,
        sortOrder: 3,
        rating: 4.7,
        patientCount: 5100,
        yearsExp: 5,
        isOnline: false,
      },
    ],
  });

  console.log('🌱 [Docker MySQL] Đã nạp thành công dữ liệu Bác sĩ mẫu qua MariaDB Adapter!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });