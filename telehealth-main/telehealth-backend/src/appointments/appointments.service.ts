import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  // Tiêm PrismaService vào để thao tác với database Docker
  constructor(private readonly prisma: PrismaService) {}

  async create(createAppointmentDto: CreateAppointmentDto) {
    const { patientId, doctorId, appointmentDate, startTime, endTime } = createAppointmentDto;

    // 1. Kiểm tra xem Bệnh nhân (Patient) có tồn tại trong hệ thống không
    const patient = await this.prisma.user.findUnique({ 
      where: { id: patientId } 
    });
    if (!patient) {
      throw new BadRequestException('Bệnh nhân không tồn tại trên hệ thống rồi bạn ơi!');
    }

    // 2. Kiểm tra xem Bác sĩ (Doctor) có tồn tại và đúng role không
    const doctor = await this.prisma.user.findUnique({ 
      where: { id: doctorId } 
    });
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new BadRequestException('Bác sĩ không tồn tại hoặc không hợp lệ!');
    }

    // 3. Tiến hành lưu lịch hẹn mới vào MySQL Docker
    const appointment = await this.prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: new Date(appointmentDate), // Ép kiểu chuỗi ngày thành Date Object
        startTime,
        endTime,
        status: 'PENDING', // Mặc định khi vừa đặt là Chờ duyệt
      },
    });

    return {
      message: "Đặt lịch hẹn khám bệnh từ xa thành công rực rỡ! Chờ bác sĩ xác nhận nha.",
      data: appointment,
    };
  }

  async findAll() {
    // Bốc toàn bộ danh sách lịch hẹn lên, nối bảng lấy kèm tên bệnh nhân và bác sĩ cho trực quan
    const appointments = await this.prisma.appointment.findMany({
      include: {
        patient: {
          select: { fullName: true, email: true }
        },
        doctor: {
          select: { fullName: true }
        }
      }
    });

    return {
      message: "Lấy danh sách toàn bộ lịch hẹn thành công!",
      data: appointments,
    };
  }

  // Logic cập nhật trạng thái lịch hẹn (Duyệt/Hủy lịch)
  async updateStatus(id: number, status: string) {
    // 1. Kiểm tra xem lịch hẹn này có tồn tại trong DB không
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn này bạn ơi!');
    }

    // 2. Kiểm tra tính hợp lệ của trạng thái gửi lên
    const validStatuses = ['PENDING', 'ACCEPTED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Trạng thái cập nhật không hợp lệ!');
    }

    // 3. Tiến hành cập nhật xuống MySQL Docker
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: { status },
    });

    return {
      message: `Cập nhật trạng thái lịch hẹn sang [${status}] thành công!`,
      data: updatedAppointment,
    };
  }

  // HÀM MỚI TÍCH HỢP TỔNG HỢP BỆNH ÁN AI: Bốc toàn bộ lịch sử y tế của một Bệnh nhân
  async getPatientMedicalHistory(patientId: number) {
    // Tìm tất cả các cuộc hẹn của bệnh nhân này và gom toàn bộ dữ liệu vệ tinh liên quan
    const medicalHistory = await this.prisma.appointment.findMany({
      where: { 
        patientId: patientId,
        status: 'COMPLETED' // Chỉ lôi những ca khám đã hoàn thành xong xuôi
      },
      include: {
        doctor: {
          select: { fullName: true, email: true }
        },
        prescriptions: true,   // Đơn thuốc điện tử bác sĩ kê
        vitalSigns: true,      // Nhịp tim đo bằng AI Camera
        aiSummaries: true,     // Tóm tắt cuộc thoại tự động của Trợ lý AI
        callLogs: true         // Nhật ký cuộc gọi
      },
      orderBy: {
        appointmentDate: 'desc' // Ca khám gần đây nhất đẩy lên đầu
      }
    });

    return {
      message: "Tải thành công lịch sử hồ sơ bệnh án điện tử tích hợp AI của bệnh nhân!",
      data: medicalHistory
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} appointment`;
  }

  update(id: number, updateAppointmentDto: UpdateAppointmentDto) {
    return `This action updates a #${id} appointment`;
  }

  remove(id: number) {
    return `This action removes a #${id} appointment`;
  }
}