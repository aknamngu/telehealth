import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { DEFAULT_APPOINTMENT_SLOTS } from '../scheduling/default-appointment-slots';

@Injectable()
export class DoctorsService {
  // Tiêm PrismaService vào ruột
  constructor(private readonly prisma: PrismaService) {}

  async create(createDoctorDto: CreateDoctorDto) {
    const { userId, specialty, experienceYears, bio } = createDoctorDto;

    // 1. Kiểm tra xem User này có tồn tại và có đúng là DOCTOR không
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'DOCTOR') {
      throw new BadRequestException('User này không tồn tại hoặc không phải là Bác sĩ!');
    }

    // 2. Dùng upsert: Nếu chưa có hồ sơ thì tạo, có rồi thì cập nhật thông tin mới
    const profile = await this.prisma.doctorProfile.upsert({
      where: { userId: userId },
      update: { specialty, experienceYears, bio },
      create: { userId, specialty, experienceYears, bio },
    });

    return {
      message: "Cập nhật hồ sơ Bác sĩ thành công mỹ mãn!",
      data: profile,
    };
  }

  async findAll() {
    // Tìm tất cả User nào có role là DOCTOR và lôi kèm cái DoctorProfile của họ lên luôn
    const doctors = await this.prisma.user.findMany({
      where: { role: 'DOCTOR' },
      select: {
        id: true,
        email: true,
        fullName: true,
        doctorProfile: true, // Nối bảng bốc dữ liệu quan hệ cực mượt bằng Prisma
        doctorReviews: {
          select: { rating: true }
        },
        doctorAppointments: {
          select: { id: true, patientId: true }
        }
      },
    });

    // Tính toán average rating và patient count (unique patientIds)
    const doctorsWithStats = doctors.map(doc => {
      let averageRating = 5.0;
      if (doc.doctorReviews.length > 0) {
        const total = doc.doctorReviews.reduce((sum, rev) => sum + rev.rating, 0);
        averageRating = total / doc.doctorReviews.length;
      }
      const uniquePatients = new Set(doc.doctorAppointments.map(a => a.patientId)).size;

      return {
        ...doc,
        rating: averageRating,
        patientCount: uniquePatients
      };
    });

    return {
      message: "Lấy danh sách Bác sĩ thành công!",
      data: doctorsWithStats,
    };
  }

  findOne(id: number) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        doctorProfile: true,
      },
    }).then((doctor) => {
      if (!doctor || doctor.role !== 'DOCTOR') {
        throw new NotFoundException('Không tìm thấy bác sĩ phù hợp!');
      }

      return {
        message: 'Lấy chi tiết bác sĩ thành công!',
        data: doctor,
      };
    });
  }

  update(id: number, updateDoctorDto: UpdateDoctorDto) {
    return `This action updates a #${id} doctor`;
  }

  remove(id: number) {
    return `This action removes a #${id} doctor`;
  }

  async getSchedules(id: number, date: string) {
    if (!date) {
      const schedules = await this.prisma.doctorSchedule.findMany({
        where: { doctorId: id },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      });
      return {
        message: 'Lấy danh sách lịch rảnh thành công!',
        data: schedules,
      };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Ngày khám không đúng định dạng YYYY-MM-DD.');
    }

    const [year, month, day] = date.split('-').map(Number);
    const dateStart = new Date(year, month - 1, day);
    const dateEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: id,
        appointmentDate: { gte: dateStart, lte: dateEnd },
        status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED'] },
      },
      select: { startTime: true },
    });
    const bookedStarts = new Set(appointments.map((item) => item.startTime));
    const now = new Date();

    const schedules = DEFAULT_APPOINTMENT_SLOTS.map((slot, index) => {
      const [hour, minute] = slot.startTime.split(':').map(Number);
      const slotStart = new Date(year, month - 1, day, hour, minute);
      return {
        id: -(index + 1),
        doctorId: id,
        date,
        ...slot,
        isBooked: bookedStarts.has(slot.startTime) || slotStart <= now,
      };
    });

    return {
      message: 'Lấy lịch mặc định 09:00–18:00 thành công!',
      data: schedules,
    };
  }

  async toggleSchedule(doctorId: number, date: string, startTime: string, endTime: string) {
    // Tìm xem lịch này đã tồn tại chưa
    const existing = await this.prisma.doctorSchedule.findFirst({
      where: {
        doctorId,
        date,
        startTime,
      },
    });

    if (existing) {
      // Nếu có rồi thì xóa đi (tức là chuyển từ Rảnh -> Bận)
      await this.prisma.doctorSchedule.delete({
        where: { id: existing.id },
      });
      return { message: 'Đã hủy giờ rảnh thành công', data: null, action: 'removed' };
    } else {
      // Nếu chưa có thì tạo mới (tức là Bận -> Rảnh)
      const newSchedule = await this.prisma.doctorSchedule.create({
        data: {
          doctorId,
          date,
          startTime,
          endTime,
        },
      });
      return { message: 'Đã thiết lập giờ rảnh thành công', data: newSchedule, action: 'added' };
    }
  }
}
