import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { MessagesGateway } from '../messages/messages.gateway';
import { isDefaultAppointmentSlot } from '../scheduling/default-appointment-slots';
import { ConfigService } from '@nestjs/config';
import { createPrescriptionVerification } from '../prescriptions/prescription-verification';
import { randomBytes } from 'node:crypto';
import {
  AppointmentEmailDetails,
  MailService,
} from '../mail/mail.service';

@Injectable()
export class AppointmentsService implements OnModuleInit, OnModuleDestroy {
  private reminderTimer?: NodeJS.Timeout;
  private reminderJobRunning = false;

  // TiÃªm cÃ¡c dá»‹ch vá»¥ DB, socket, cáº¥u hÃ¬nh vÃ  email.
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  onModuleInit() {
    if (!this.mail.isConfigured()) {
      return;
    }

    this.reminderTimer = setInterval(
      () => void this.sendDueAppointmentReminders(),
      60_000,
    );
    this.reminderTimer.unref();
    void this.sendDueAppointmentReminders();
  }

  onModuleDestroy() {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
    }
  }

  async create(
    createAppointmentDto: CreateAppointmentDto,
    user: { sub: number; role: string },
  ) {
    const { patientId, doctorId, appointmentDate, startTime, endTime } =
      createAppointmentDto;
    const symptoms = createAppointmentDto.symptoms?.trim();
    const paymentMethod =
      createAppointmentDto.paymentMethod === 'CASSO' ? 'CASSO' : 'WALLET';

    if (!appointmentDate || !startTime || !endTime) {
      throw new BadRequestException(
        'Vui lÃ²ng chá»n Ä‘áº§y Ä‘á»§ ngÃ y khÃ¡m vÃ  khung giá» cÃ²n trá»‘ng.',
      );
    }
    if (!symptoms) {
      throw new BadRequestException(
        'Vui lÃ²ng mÃ´ táº£ triá»‡u chá»©ng trÆ°á»›c khi Ä‘áº·t lá»‹ch.',
      );
    }

    const resolvedPatientId = user.role === 'PATIENT' ? user.sub : patientId;
    const resolvedDoctorId = user.role === 'DOCTOR' ? user.sub : doctorId;

    // 1. Kiá»ƒm tra xem Bá»‡nh nhÃ¢n (Patient) cÃ³ tá»“n táº¡i trong há»‡ thá»‘ng khÃ´ng
    const patient = await this.prisma.user.findUnique({
      where: { id: resolvedPatientId },
    });
    if (!patient || patient.role !== 'PATIENT') {
      throw new BadRequestException(
        'Bá»‡nh nhÃ¢n khÃ´ng tá»“n táº¡i trÃªn há»‡ thá»‘ng rá»“i báº¡n Æ¡i!',
      );
    }

    // 2. Kiá»ƒm tra xem BÃ¡c sÄ© (Doctor) cÃ³ tá»“n táº¡i vÃ  Ä‘Ãºng role khÃ´ng
    const doctor = await this.prisma.user.findUnique({
      where: { id: resolvedDoctorId },
    });
    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new BadRequestException('BÃ¡c sÄ© khÃ´ng tá»“n táº¡i hoáº·c khÃ´ng há»£p lá»‡!');
    }

    if (user.role === 'PATIENT' && user.sub !== resolvedPatientId) {
      throw new ForbiddenException('Báº¡n chá»‰ cÃ³ thá»ƒ táº¡o lá»‹ch cho chÃ­nh mÃ¬nh!');
    }

    if (user.role === 'DOCTOR' && user.sub !== resolvedDoctorId) {
      throw new ForbiddenException(
        'BÃ¡c sÄ© chá»‰ cÃ³ thá»ƒ táº¡o lá»‹ch cho chÃ­nh mÃ¬nh!',
      );
    }

    if (!isDefaultAppointmentSlot(startTime, endTime)) {
      throw new BadRequestException(
        'Khung giá» khÃ´ng thuá»™c lá»‹ch khÃ¡m máº·c Ä‘á»‹nh 09:00â€“18:00.',
      );
    }

    // 2.5 Kiá»ƒm tra xem BÃ¡c sÄ© Ä‘Ã£ cÃ³ lá»‹ch trÃ¹ng ngÃ y vÃ  khung giá» nÃ y chÆ°a
    const targetDate = new Date(appointmentDate);
    const dateStart = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const dateEnd = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      23,
      59,
      59,
    );

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
      throw new BadRequestException(
        `BÃ¡c sÄ© Ä‘Ã£ cÃ³ lá»‹ch khÃ¡m vÃ o khung giá» ${startTime} - ${endTime} ngÃ y ${targetDate.toLocaleDateString('vi-VN')} rá»“i! Vui lÃ²ng chá»n khung giá» khÃ¡c.`,
      );
    }

    // 2.6 Kiá»ƒm tra xem Bá»‡nh nhÃ¢n Ä‘Ã£ cÃ³ lá»‹ch trÃ¹ng ngÃ y vÃ  khung giá» nÃ y vá»›i bÃ¡c sÄ© khÃ¡c chÆ°a
    const existingPatientConflict = await this.prisma.appointment.findFirst({
      where: {
        patientId: resolvedPatientId,
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

    if (existingPatientConflict) {
      throw new BadRequestException(
        `Báº¡n Ä‘Ã£ cÃ³ lá»‹ch háº¹n khÃ¡m vÃ o khung giá» ${startTime} - ${endTime} ngÃ y ${targetDate.toLocaleDateString('vi-VN')} rá»“i! Má»—i khung giá» chá»‰ Ä‘Æ°á»£c Ä‘áº·t 1 bÃ¡c sÄ©.`,
      );
    }

    // 2.7 Kiá»ƒm tra nguá»“n thanh toÃ¡n tÆ°Æ¡ng á»©ng.
    const FEE = 100000;
    if (paymentMethod === 'WALLET') {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId: resolvedPatientId },
      });
      if (!wallet || wallet.balance < FEE) {
        throw new BadRequestException(
          'Sá»‘ dÆ° vÃ­ khÃ´ng Ä‘á»§ Ä‘á»ƒ Ä‘áº·t lá»‹ch háº¹n! (100.000 VNÄ)',
        );
      }
    } else if (
      !this.config.get<string>('PAYMENT_BANK_ID')?.trim() ||
      !this.config.get<string>('PAYMENT_ACCOUNT_NO')?.trim()
    ) {
      throw new BadRequestException(
        'ChÆ°a cáº¥u hÃ¬nh tÃ i khoáº£n ngÃ¢n hÃ ng Ä‘á»ƒ táº¡o mÃ£ QR thanh toÃ¡n.',
      );
    }

    // 3. LÆ°u lá»‹ch háº¹n vÃ  táº¡o hoÃ¡ Ä‘Æ¡n. Casso giá»¯ PENDING Ä‘áº¿n khi webhook tá»›i.
    const result = await this.prisma.$transaction(async (prisma) => {
      const selectedSchedule = await prisma.doctorSchedule.upsert({
        where: {
          doctorId_date_startTime: {
            doctorId: resolvedDoctorId,
            date: appointmentDate,
            startTime,
          },
        },
        update: { endTime },
        create: {
          doctorId: resolvedDoctorId,
          date: appointmentDate,
          startTime,
          endTime,
          isBooked: false,
        },
      });
      const reservedSlot = await prisma.doctorSchedule.updateMany({
        where: { id: selectedSchedule.id, isBooked: false },
        data: { isBooked: true },
      });
      if (reservedSlot.count !== 1) {
        throw new BadRequestException(
          'Khung giá» vá»«a Ä‘Æ°á»£c ngÆ°á»i khÃ¡c Ä‘áº·t. Vui lÃ²ng chá»n khung giá» khÃ¡c.',
        );
      }

      const appt = await prisma.appointment.create({
        data: {
          patientId: resolvedPatientId,
          doctorId: resolvedDoctorId,
          appointmentDate: new Date(appointmentDate),
          startTime,
          endTime,
          symptoms,
          status: 'PENDING',
        },
        include: { patient: { select: { fullName: true } } },
      });

      if (paymentMethod === 'WALLET') {
        await prisma.wallet.update({
          where: { userId: resolvedPatientId },
          data: { balance: { decrement: FEE } },
        });
      }

      const paymentCode =
        paymentMethod === 'CASSO'
          ? `TH${appt.id}${randomBytes(2).toString('hex').toUpperCase()}`
          : null;
      const invoice = await prisma.invoice.create({
        data: {
          appointmentId: appt.id,
          patientId: resolvedPatientId,
          amount: FEE,
          status: paymentMethod === 'CASSO' ? 'PENDING' : 'PAID',
          paymentMethod,
          paymentCode,
          paidAt: paymentMethod === 'WALLET' ? new Date() : null,
        },
      });

      return { appointment: appt, invoice };
    });

    // 4. Emit real-time socket notification tá»›i phÃ²ng bÃ¡c sÄ©
    try {
      this.gateway.server
        .to(`doctor_${resolvedDoctorId}`)
        .emit('appointment:new', {
          appointmentId: result.appointment.id,
          patientName: result.appointment.patient?.fullName ?? 'Bá»‡nh nhÃ¢n',
          date: appointmentDate,
          startTime,
        });
    } catch {
      /* Gateway chÆ°a ready thÃ¬ bá» qua */
    }

    await this.notifyAppointmentParticipants(
      {
        id: result.appointment.id,
        appointmentDate: new Date(appointmentDate),
        startTime,
        endTime,
        status: result.appointment.status,
        patient: { email: patient.email, fullName: patient.fullName },
        doctor: { email: doctor.email, fullName: doctor.fullName },
      },
      'BOOKED',
    );

    const bankId = this.config.get<string>('PAYMENT_BANK_ID')?.trim() ?? '';
    const accountNo = this.config.get<string>('PAYMENT_ACCOUNT_NO')?.trim() ?? '';
    const accountName = this.config.get<string>('PAYMENT_ACCOUNT_NAME')?.trim() ?? '';
    const qrImageUrl = result.invoice.paymentCode
      ? `https://img.vietqr.io/image/${encodeURIComponent(bankId)}-${encodeURIComponent(accountNo)}-compact2.png?amount=${FEE}&addInfo=${encodeURIComponent(result.invoice.paymentCode)}&accountName=${encodeURIComponent(accountName)}`
      : null;

    return {
      message:
        paymentMethod === 'CASSO'
          ? 'ÄÃ£ giá»¯ lá»‹ch. Vui lÃ²ng quÃ©t QR Ä‘á»ƒ hoÃ n táº¥t thanh toÃ¡n.'
          : 'Äáº·t lá»‹ch háº¹n khÃ¡m bá»‡nh tá»« xa thÃ nh cÃ´ng! Chá» bÃ¡c sÄ© xÃ¡c nháº­n.',
      data: {
        appointment: result.appointment,
        invoice: result.invoice,
        payment:
          paymentMethod === 'CASSO'
            ? {
                qrImageUrl,
                bankId,
                accountNo,
                accountName,
                amount: FEE,
                paymentCode: result.invoice.paymentCode,
              }
            : null,
      },
    };
  }

  // Táº¡o nhanh há»“ sÆ¡ cáº¥p cá»©u SOS (Láº¥y BÃ¡c sÄ© Ä‘áº§u tiÃªn lÃ m dummy)
  async createEmergency(
    emergencyType: string,
    user: { sub: number; role: string },
  ) {
    if (user.role !== 'PATIENT') {
      throw new ForbiddenException(
        'Chá»‰ bá»‡nh nhÃ¢n má»›i Ä‘Æ°á»£c dÃ¹ng tÃ­nh nÄƒng cáº¥p cá»©u!',
      );
    }

    // TÃ¬m má»™t bÃ¡c sÄ© báº¥t ká»³ (dummy) Ä‘á»ƒ gÃ¡n vÃ o record (vÃ¬ báº£ng yÃªu cáº§u cÃ³ doctorId)
    const doctor = await this.prisma.user.findFirst({
      where: { role: 'DOCTOR' },
    });
    if (!doctor) {
      throw new BadRequestException(
        'Há»‡ thá»‘ng chÆ°a cÃ³ bÃ¡c sÄ© nÃ o, khÃ´ng thá»ƒ táº¡o ca cáº¥p cá»©u!',
      );
    }

    const now = new Date();
    const appointment = await this.prisma.appointment.create({
      data: {
        patientId: user.sub,
        doctorId: doctor.id,
        appointmentDate: now,
        startTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
        endTime: `${now.getHours() + 1}:${now.getMinutes().toString().padStart(2, '0')}`,
        symptoms: emergencyType,
        status: 'PENDING',
      },
    });

    return {
      message: 'Táº¡o ca cáº¥p cá»©u thÃ nh cÃ´ng!',
      data: {
        appointmentId: appointment.id,
        doctorId: doctor.id,
      },
    };
  }

  async findAll(user: { sub: number; role: string }) {
    // Bá»‘c toÃ n bá»™ danh sÃ¡ch lá»‹ch háº¹n lÃªn, ná»‘i báº£ng láº¥y kÃ¨m tÃªn bá»‡nh nhÃ¢n vÃ  bÃ¡c sÄ© cho trá»±c quan
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
          select: { fullName: true, email: true },
        },
        doctor: {
          select: { fullName: true },
        },
        prescriptions: true,
        review: true,
        aiSummaries: true,
      },
    });

    return {
      message: 'Láº¥y danh sÃ¡ch toÃ n bá»™ lá»‹ch háº¹n thÃ nh cÃ´ng!',
      data: appointments,
    };
  }

  // Logic cáº­p nháº­t tráº¡ng thÃ¡i lá»‹ch háº¹n (Duyá»‡t/Há»§y lá»‹ch)
  async updateStatus(
    id: number,
    status: string,
    user: { sub: number; role: string },
  ) {
    // 1. Kiá»ƒm tra xem lá»‹ch háº¹n nÃ y cÃ³ tá»“n táº¡i trong DB khÃ´ng
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        patient: { select: { email: true, fullName: true } },
        doctor: { select: { email: true, fullName: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y lá»‹ch háº¹n nÃ y báº¡n Æ¡i!');
    }

    // 2. Kiá»ƒm tra tÃ­nh há»£p lá»‡ cá»§a tráº¡ng thÃ¡i gá»­i lÃªn
    const validStatuses = [
      'PENDING',
      'ACCEPTED',
      'CONFIRMED',
      'CANCELLED',
      'COMPLETED',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Tráº¡ng thÃ¡i cáº­p nháº­t khÃ´ng há»£p lá»‡!');
    }

    // 3. PhÃ¢n quyá»n: Bá»‡nh nhÃ¢n chá»‰ Ä‘Æ°á»£c tá»± há»§y lá»‹ch cá»§a mÃ¬nh (CANCELLED only)
    if (user.role === 'PATIENT') {
      if (appointment.patientId !== user.sub) {
        throw new ForbiddenException('Báº¡n chá»‰ cÃ³ thá»ƒ há»§y lá»‹ch cá»§a chÃ­nh mÃ¬nh!');
      }
      if (status !== 'CANCELLED') {
        throw new ForbiddenException('Bá»‡nh nhÃ¢n chá»‰ Ä‘Æ°á»£c phÃ©p há»§y lá»‹ch háº¹n!');
      }
      if (!['PENDING', 'CONFIRMED'].includes(appointment.status)) {
        throw new BadRequestException(
          'Lá»‹ch háº¹n nÃ y khÃ´ng thá»ƒ há»§y (Ä‘Ã£ hoÃ n thÃ nh hoáº·c Ä‘Ã£ há»§y trÆ°á»›c Ä‘Ã³)!',
        );
      }
    }

    if (user.role === 'DOCTOR' && appointment.doctorId !== user.sub) {
      throw new ForbiddenException(
        'BÃ¡c sÄ© chá»‰ cÃ³ thá»ƒ cáº­p nháº­t lá»‹ch cá»§a chÃ­nh mÃ¬nh!',
      );
    }

    // 4. Tiáº¿n hÃ nh cáº­p nháº­t xuá»‘ng MySQL Docker
    let updatedAppointment;

    if (status === 'CANCELLED') {
      updatedAppointment = await this.prisma.$transaction(async (prisma) => {
        const appt = await prisma.appointment.update({
          where: { id },
          data: { status },
        });
        await prisma.invoice.updateMany({
          where: { appointmentId: id, status: 'PAID' },
          data: { status: 'PENDING_REFUND' },
        });
        await prisma.doctorSchedule.updateMany({
          where: {
            doctorId: appointment.doctorId,
            date: appointment.appointmentDate.toISOString().slice(0, 10),
            startTime: appointment.startTime,
            endTime: appointment.endTime,
          },
          data: { isBooked: false },
        });
        return appt;
      });
    } else {
      updatedAppointment = await this.prisma.appointment.update({
        where: { id },
        data: { status },
      });
    }

    await this.notifyAppointmentParticipants(
      { ...appointment, status },
      'STATUS_CHANGED',
    );

    return {
      message: `Cáº­p nháº­t tráº¡ng thÃ¡i lá»‹ch háº¹n sang [${status}] thÃ nh cÃ´ng!`,
      data: updatedAppointment,
    };
  }

  // HoÃ n táº¥t ca khÃ¡m: Ghi cháº©n Ä‘oÃ¡n, kÃª Ä‘Æ¡n thuá»‘c vÃ  Ä‘á»•i tráº¡ng thÃ¡i thÃ nh COMPLETED
  async completeConsultation(
    id: number,
    diagnosis: string,
    medicines: string,
    user: { sub: number; role: string },
  ) {
    if (user.role !== 'DOCTOR') {
      throw new ForbiddenException(
        'Chá»‰ bÃ¡c sÄ© má»›i cÃ³ quyá»n kÃª Ä‘Æ¡n vÃ  hoÃ n táº¥t ca khÃ¡m!',
      );
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y lá»‹ch háº¹n nÃ y!');
    }

    if (appointment.doctorId !== user.sub) {
      throw new ForbiddenException(
        'Báº¡n chá»‰ cÃ³ thá»ƒ kÃª Ä‘Æ¡n cho bá»‡nh nhÃ¢n cá»§a mÃ¬nh!',
      );
    }

    const existingPrescription = await this.prisma.prescription.findFirst({
      where: { appointmentId: id },
    });

    if (existingPrescription) {
      throw new BadRequestException(
        'Cuá»™c háº¹n nÃ y Ä‘Ã£ Ä‘Æ°á»£c hoÃ n táº¥t vÃ  kÃª Ä‘Æ¡n rá»“i!',
      );
    }

    // DÃ¹ng transaction Ä‘á»ƒ Ä‘áº£m báº£o lÆ°u Ä‘Æ¡n thuá»‘c vÃ  Ä‘á»•i status cÃ¹ng lÃºc
    const result = await this.prisma.$transaction(async (prisma) => {
      const verification = createPrescriptionVerification(
        {
          appointmentId: id,
          doctorId: appointment.doctorId,
          patientId: appointment.patientId,
          diagnosis,
          medicines,
        },
        this.config.get<string>('PRESCRIPTION_SIGNING_KEY') ??
          this.config.get<string>('JWT_SECRET') ??
          'telehealth-local-prescription-key',
      );

      // 1. Táº¡o Ä‘Æ¡n thuá»‘c
      const prescription = await prisma.prescription.create({
        data: {
          appointmentId: id,
          diagnosis,
          medicines,
          ...verification,
        },
      });

      // 2. Cáº­p nháº­t tráº¡ng thÃ¡i cuá»™c háº¹n
      const updatedAppt = await prisma.appointment.update({
        where: { id },
        data: { status: 'COMPLETED' },
      });

      return { prescription, appointment: updatedAppt };
    });

    return {
      message: 'LÆ°u cháº©n Ä‘oÃ¡n, Ä‘Æ¡n thuá»‘c vÃ  hoÃ n táº¥t ca khÃ¡m thÃ nh cÃ´ng!',
      data: result,
    };
  }

  // Cá»•ng Ä‘Ã¡nh giÃ¡ bÃ¡c sÄ©
  async submitReview(
    id: number,
    rating: number,
    comment: string,
    user: { sub: number; role: string },
  ) {
    if (user.role !== 'PATIENT') {
      throw new ForbiddenException('Chá»‰ bá»‡nh nhÃ¢n má»›i cÃ³ quyá»n Ä‘Ã¡nh giÃ¡!');
    }

    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y lá»‹ch háº¹n nÃ y!');
    }

    if (appointment.patientId !== user.sub) {
      throw new ForbiddenException(
        'Báº¡n chá»‰ cÃ³ thá»ƒ Ä‘Ã¡nh giÃ¡ ca khÃ¡m cá»§a chÃ­nh mÃ¬nh!',
      );
    }

    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Chá»‰ cÃ³ thá»ƒ Ä‘Ã¡nh giÃ¡ sau khi ca khÃ¡m Ä‘Ã£ hoÃ n táº¥t!',
      );
    }

    const existingReview = await this.prisma.review.findUnique({
      where: { appointmentId: id },
    });

    if (existingReview) {
      throw new BadRequestException('Báº¡n Ä‘Ã£ Ä‘Ã¡nh giÃ¡ ca khÃ¡m nÃ y rá»“i!');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Sá»‘ sao Ä‘Ã¡nh giÃ¡ pháº£i tá»« 1 Ä‘áº¿n 5!');
    }

    const review = await this.prisma.review.create({
      data: {
        appointmentId: id,
        patientId: user.sub,
        doctorId: appointment.doctorId,
        rating,
        comment,
      },
    });

    return {
      message: 'ÄÃ¡nh giÃ¡ thÃ nh cÃ´ng!',
      data: review,
    };
  }

  // HÃ€M Má»šI TÃCH Há»¢P Tá»”NG Há»¢P Bá»†NH ÃN AI: Bá»‘c toÃ n bá»™ lá»‹ch sá»­ y táº¿ cá»§a má»™t Bá»‡nh nhÃ¢n
  async getPatientMedicalHistory(
    patientId: number,
    user: { sub: number; role: string },
  ) {
    if (user.role === 'PATIENT' && user.sub !== patientId) {
      throw new ForbiddenException(
        'Báº¡n chá»‰ cÃ³ thá»ƒ xem lá»‹ch sá»­ cá»§a chÃ­nh mÃ¬nh!',
      );
    }

    // TÃ¬m táº¥t cáº£ cÃ¡c cuá»™c háº¹n cá»§a bá»‡nh nhÃ¢n nÃ y vÃ  gom toÃ n bá»™ dá»¯ liá»‡u vá»‡ tinh liÃªn quan
    const medicalHistory = await this.prisma.appointment.findMany({
      where: {
        patientId: patientId,
        status: 'COMPLETED', // Chá»‰ lÃ´i nhá»¯ng ca khÃ¡m Ä‘Ã£ hoÃ n thÃ nh xong xuÃ´i
      },
      include: {
        doctor: {
          select: { fullName: true, email: true },
        },
        prescriptions: true, // ÄÆ¡n thuá»‘c Ä‘iá»‡n tá»­ bÃ¡c sÄ© kÃª
        vitalSigns: true, // Chá»‰ sá»‘ kÃ¨m nguá»“n: nháº­p tay, Bluetooth hoáº·c mÃ´ phá»ng
        aiSummaries: true, // TÃ³m táº¯t cuá»™c thoáº¡i tá»± Ä‘á»™ng cá»§a Trá»£ lÃ½ AI
        callLogs: true, // Nháº­t kÃ½ cuá»™c gá»i
      },
      orderBy: {
        appointmentDate: 'desc', // Ca khÃ¡m gáº§n Ä‘Ã¢y nháº¥t Ä‘áº©y lÃªn Ä‘áº§u
      },
    });

    return {
      message:
        'Táº£i thÃ nh cÃ´ng lá»‹ch sá»­ há»“ sÆ¡ bá»‡nh Ã¡n Ä‘iá»‡n tá»­ tÃ­ch há»£p AI cá»§a bá»‡nh nhÃ¢n!',
      data: medicalHistory,
    };
  }

  private async sendDueAppointmentReminders() {
    if (this.reminderJobRunning || !this.mail.isConfigured()) {
      return;
    }

    this.reminderJobRunning = true;
    try {
      const now = new Date();
      const searchStart = new Date(now.getTime() - 60 * 60 * 1000);
      const searchEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
      const appointments = await this.prisma.appointment.findMany({
        where: {
          appointmentDate: { gte: searchStart, lte: searchEnd },
          status: { in: ['PENDING', 'CONFIRMED', 'ACCEPTED'] },
          OR: [
            { reminderEmailSentAt: null },
            { reminder30mEmailSentAt: null },
          ],
        },
        include: {
          patient: { select: { email: true, fullName: true } },
          doctor: { select: { email: true, fullName: true } },
        },
      });

      for (const appointment of appointments) {
        const scheduledAt = this.getScheduledAt(appointment);
        const millisecondsUntilAppointment =
          scheduledAt.getTime() - now.getTime();
        if (millisecondsUntilAppointment <= 0) {
          continue;
        }

        const thirtyMinutes = 30 * 60 * 1000;
        const twentyFourHours = 24 * 60 * 60 * 1000;

        if (
          millisecondsUntilAppointment <= thirtyMinutes &&
          !appointment.reminder30mEmailSentAt
        ) {
          const delivered = await this.notifyAppointmentParticipants(
            appointment,
            'REMINDER_30M',
          );
          if (delivered) {
            await this.prisma.appointment.update({
              where: { id: appointment.id },
              data: { reminder30mEmailSentAt: new Date() },
            });
          }
          continue;
        }

        if (
          millisecondsUntilAppointment <= twentyFourHours &&
          !appointment.reminderEmailSentAt
        ) {
          const delivered = await this.notifyAppointmentParticipants(
            appointment,
            'REMINDER_24H',
          );
          if (delivered) {
            await this.prisma.appointment.update({
              where: { id: appointment.id },
              data: { reminderEmailSentAt: new Date() },
            });
          }
        }
      }
    } catch (error) {
      console.warn(
        'Job nháº¯c lá»‹ch email gáº·p lá»—i:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    } finally {
      this.reminderJobRunning = false;
    }
  }

  private getScheduledAt(appointment: {
    appointmentDate: Date;
    startTime: string;
  }) {
    const date = appointment.appointmentDate.toISOString().slice(0, 10);
    return new Date(`${date}T${appointment.startTime}:00+07:00`);
  }

  private async notifyAppointmentParticipants(
    appointment: {
      id: number;
      appointmentDate: Date;
      startTime: string;
      endTime: string;
      status: string;
      patient: { email: string; fullName: string };
      doctor: { email: string; fullName: string };
    },
    kind: AppointmentEmailDetails['kind'],
  ) {
    const common = {
      appointmentId: appointment.id,
      patientName: appointment.patient.fullName,
      doctorName: appointment.doctor.fullName,
      appointmentDate: appointment.appointmentDate,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      status: appointment.status,
      kind,
    };

    const results = await Promise.all([
      this.mail.sendAppointmentEmail(appointment.patient.email, {
        ...common,
        recipientName: appointment.patient.fullName,
      }),
      this.mail.sendAppointmentEmail(appointment.doctor.email, {
        ...common,
        recipientName: appointment.doctor.fullName,
      }),
    ]);
    return results.some(Boolean);
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


