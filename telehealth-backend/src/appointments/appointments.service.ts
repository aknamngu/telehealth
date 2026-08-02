import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { MessagesGateway } from '../messages/messages.gateway';

@Injectable()
export class AppointmentsService {
  // Tiêm PrismaService và MessagesGateway vào để thao tác DB và emit socket
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) { }

  async create(createAppointmentDto: CreateAppointmentDto, user: { sub: number; role: string }) {
    const { patientId, doctorId, appointmentDate, startTime, endTime } = createAppointmentDto;
    const resolvedPatientId = user.role === 'PATIENT' ? user.sub : patientId;
    const resolvedDoctorId = user.role === 'DOCTOR' ? user.sub : doctorId;

    // 1. Kiểm tra xem Bệnh nhân (Patient) có tồn tại trong hệ thống không
    const patient = await this.prisma.user.findUnique({
      where: { id: resolvedPatientId }
    });
    if (!patient || patient.role !== 'PATIENT') {
      throw new BadRequestException('Bệnh nhân không tồn tại trên hệ thống rồi bạn ơi!');
    }

    // 2. Kiểm tra xem Bác sĩ (Doctor) có tồn tại và đúng role không
    const doctor = await this.prisma.user.findUnique({
      where: { id: resolvedDoctorId }
    });
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new BadRequestException('Bác sĩ không tồn tại hoặc không hợp lệ!');
    }

    if (user.role === 'PATIENT' && user.sub !== resolvedPatientId) {
      throw new ForbiddenException('Bạn chỉ có thể tạo lịch cho chính mình!');
    }

    if (user.role === 'DOCTOR' && user.sub !== resolvedDoctorId) {
      throw new ForbiddenException('Bác sĩ chỉ có thể tạo lịch cho chính mình!');
    }

    // 2.5 Kiểm tra xem Bác sĩ đã có lịch trùng ngày và khung giờ này chưa
    const targetDate = new Date(appointmentDate);
    const dateStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dateEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const existingConflict = await this.prisma.appointment.findFirst({
      where: {
        doctorId: resolvedDoctorId,
        appointmentDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        startTime,
        status: {
          in: ['PENDING', 'CONFIRMED', 'ACCEPTED'],
        },
      },
    });

    if (existingConflict) {
      throw new BadRequestException(`Bác sĩ đã có lịch khám vào khung giờ ${startTime} - ${endTime} ngày ${targetDate.toLocaleDateString('vi-VN')} rồi! Vui lòng chọn khung giờ khác.`);
    }

    // 3. Tiến hành lưu lịch hẹn mới vào MySQL Docker
    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: resolvedPatientId,
        doctorId: resolvedDoctorId,
        appointmentDate: new Date(appointmentDate), // Ép kiểu chuỗi ngày thành Date Object
        startTime,
        endTime,
        status: 'PENDING', // Mặc định khi vừa đặt là Chờ duyệt
      },
      include: { patient: { select: { fullName: true } } },
    });

    // 4. Emit real-time socket notification tới phòng bác sĩ
    try {
      this.gateway.server.to(`doctor_${resolvedDoctorId}`).emit('appointment:new', {
        appointmentId: appointment.id,
        patientName: appointment.patient?.fullName ?? 'Bệnh nhân',
        date: appointmentDate,
        startTime,
      });
    } catch { /* Gateway chưa ready thì bỏ qua */ }

    return {
      message: "Đặt lịch hẹn khám bệnh từ xa thành công rực rỡ! Chờ bác sĩ xác nhận nha.",
      data: appointment,
    };
  }

  // Tạo nhanh hồ sơ cấp cứu SOS (Lấy Bác sĩ đầu tiên làm dummy)
  async createEmergency(emergencyType: string, user: { sub: number; role: string }) {
    if (user.role !== 'PATIENT') {
      throw new ForbiddenException('Chỉ bệnh nhân mới được dùng tính năng cấp cứu!');
    }

    // Tìm một bác sĩ bất kỳ (dummy) để gán vào record (vì bảng yêu cầu có doctorId)
    const doctor = await this.prisma.user.findFirst({ where: { role: 'DOCTOR' } });
    if (!doctor) {
      throw new BadRequestException('Hệ thống chưa có bác sĩ nào, không thể tạo ca cấp cứu!');
    }

    const now = new Date();
    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: user.sub,
        doctorId: doctor.id,
        appointmentDate: now,
        startTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
        endTime: `${now.getHours() + 1}:${now.getMinutes().toString().padStart(2, '0')}`,
        status: 'PENDING',
      }
    });

    return {
      message: "Tạo ca cấp cứu thành công!",
      data: {
        appointmentId: appointment.id,
        doctorId: doctor.id
      }
    };
  }

  async findAll(user: { sub: number; role: string }) {
    // Bốc toàn bộ danh sách lịch hẹn lên, nối bảng lấy kèm tên bệnh nhân và bác sĩ cho trực quan
    const where =
      user.role === 'ADMIN'
        ? undefined
        : user.role === 'DOCTOR'
          ? { doctorId: user.sub }
          : { patientId: user.sub };

    const appointments = await this.prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: { fullName: true, email: true }
        },
        doctor: {
          select: { fullName: true }
        },
        prescriptions: true,
        review: true,
        aiSummaries: true,
      }
    });

    return {
      message: "Lấy danh sách toàn bộ lịch hẹn thành công!",
      data: appointments,
    };
  }

  // Logic cập nhật trạng thái lịch hẹn (Duyệt/Hủy lịch)
  async updateStatus(id: number, status: string, user: { sub: number; role: string }) {
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

    // 3. Phân quyền: Bệnh nhân chỉ được tự hủy lịch của mình (CANCELLED only)
    if (user.role === 'PATIENT') {
      if (appointment.patientId !== user.sub) {
        throw new ForbiddenException('Bạn chỉ có thể hủy lịch của chính mình!');
      }
      if (status !== 'CANCELLED') {
        throw new ForbiddenException('Bệnh nhân chỉ được phép hủy lịch hẹn!');
      }
      if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
        throw new BadRequestException('Lịch hẹn này không thể hủy (đã hoàn thành hoặc đã hủy trước đó)!');
      }
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bác sĩ chỉ có thể cập nhật lịch của chính mình!');
    }

    // 4. Tiến hành cập nhật xuống MySQL Docker
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: { status },
    });

    return {
      message: `Cập nhật trạng thái lịch hẹn sang [${status}] thành công!`,
      data: updatedAppointment,
    };
  }

  // Hoàn tất ca khám: Ghi chẩn đoán, kê đơn thuốc và đổi trạng thái thành COMPLETED
  async completeConsultation(id: number, diagnosis: string, medicines: string, user: { sub: number; role: string }) {
    if (user.role !== 'DOCTOR') {
      throw new ForbiddenException('Chỉ bác sĩ mới có quyền kê đơn và hoàn tất ca khám!');
    }

    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn này!');
    }

    if (appointment.doctorId !== user.sub) {
      throw new ForbiddenException('Bạn chỉ có thể kê đơn cho bệnh nhân của mình!');
    }

    const existingPrescription = await this.prisma.prescription.findFirst({
      where: { appointmentId: id }
    });

    if (existingPrescription) {
      throw new BadRequestException('Cuộc hẹn này đã được hoàn tất và kê đơn rồi!');
    }

    // Dùng transaction để đảm bảo lưu đơn thuốc và đổi status cùng lúc
    const result = await this.prisma.$transaction(async (prisma) => {
      // 1. Tạo đơn thuốc
      const prescription = await prisma.prescription.create({
        data: {
          appointmentId: id,
          diagnosis,
          medicines,
        }
      });

      // 2. Cập nhật trạng thái cuộc hẹn
      const updatedAppt = await prisma.appointment.update({
        where: { id },
        data: { status: 'COMPLETED' }
      });

      return { prescription, appointment: updatedAppt };
    });

    return {
      message: 'Lưu chẩn đoán, đơn thuốc và hoàn tất ca khám thành công!',
      data: result,
    };
  }

  // Cổng đánh giá bác sĩ
  async submitReview(id: number, rating: number, comment: string, user: { sub: number; role: string }) {
    if (user.role !== 'PATIENT') {
      throw new ForbiddenException('Chỉ bệnh nhân mới có quyền đánh giá!');
    }

    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) {
      throw new NotFoundException('Không tìm thấy lịch hẹn này!');
    }

    if (appointment.patientId !== user.sub) {
      throw new ForbiddenException('Bạn chỉ có thể đánh giá ca khám của chính mình!');
    }

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException('Chỉ có thể đánh giá sau khi ca khám đã hoàn tất!');
    }

    const existingReview = await this.prisma.review.findUnique({
      where: { appointmentId: id }
    });

    if (existingReview) {
      throw new BadRequestException('Bạn đã đánh giá ca khám này rồi!');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Số sao đánh giá phải từ 1 đến 5!');
    }

    const review = await this.prisma.review.create({
      data: {
        appointmentId: id,
        patientId: user.sub,
        doctorId: appointment.doctorId,
        rating,
        comment
      }
    });

    return {
      message: 'Đánh giá thành công!',
      data: review
    };
  }

  // HÀM MỚI TÍCH HỢP TỔNG HỢP BỆNH ÁN AI: Bốc toàn bộ lịch sử y tế của một Bệnh nhân
  async getPatientMedicalHistory(patientId: number, user: { sub: number; role: string }) {
    if (user.role === 'PATIENT' && user.sub !== patientId) {
      throw new ForbiddenException('Bạn chỉ có thể xem lịch sử của chính mình!');
    }

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