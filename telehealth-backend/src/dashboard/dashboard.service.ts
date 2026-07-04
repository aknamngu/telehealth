import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardForUser(user: { sub: number; role: string }) {
    if (user.role === 'ADMIN') {
      return this.getAdminDashboard();
    }

    if (user.role === 'PATIENT') {
      return this.getPatientDashboard(user.sub);
    }

    if (user.role === 'DOCTOR') {
      return this.getDoctorDashboard(user.sub);
    }

    throw new ForbiddenException('Vai trò hiện tại không được hỗ trợ cho dashboard!');
  }

  private async resolvePatientId(patientId?: number) {
    if (patientId) {
      const patient = await this.prisma.user.findUnique({ where: { id: patientId } });
      if (patient && patient.role === 'PATIENT') {
        return patient.id;
      }
    }

    const fallbackPatient = await this.prisma.user.findFirst({
      where: { role: 'PATIENT' },
      orderBy: { id: 'asc' },
    });

    if (!fallbackPatient) {
      throw new NotFoundException('Không tìm thấy bệnh nhân phù hợp!');
    }

    return fallbackPatient.id;
  }

  private async resolveDoctorId(doctorId?: number) {
    if (doctorId) {
      const doctor = await this.prisma.user.findUnique({ where: { id: doctorId } });
      if (doctor && doctor.role === 'DOCTOR') {
        return doctor.id;
      }
    }

    const fallbackDoctor = await this.prisma.user.findFirst({
      where: { role: 'DOCTOR' },
      orderBy: { id: 'asc' },
    });

    if (!fallbackDoctor) {
      throw new NotFoundException('Không tìm thấy bác sĩ phù hợp!');
    }

    return fallbackDoctor.id;
  }

  async getAdminDashboard() {
    const [userCount, doctorCount, patientCount, appointmentCount, prescriptionCount, messageCount, vitalCount] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'DOCTOR' } }),
      this.prisma.user.count({ where: { role: 'PATIENT' } }),
      this.prisma.appointment.count(),
      this.prisma.prescription.count(),
      this.prisma.messageLog.count(),
      this.prisma.vitalSignsAI.count(),
    ]);

    const [statusStats, recentAppointments, recentMessages, recentPrescriptions, recentVitals, topDoctors] = await Promise.all([
      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.appointment.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          patient: { select: { id: true, fullName: true, email: true } },
          doctor: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.messageLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          sender: { select: { id: true, fullName: true, role: true } },
          appointment: { select: { id: true, status: true } },
        },
      }),
      this.prisma.prescription.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          appointment: {
            include: {
              patient: { select: { fullName: true } },
              doctor: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.vitalSignsAI.findMany({
        orderBy: { measuredAt: 'desc' },
        take: 8,
        include: {
          appointment: {
            include: {
              patient: { select: { fullName: true } },
              doctor: { select: { fullName: true } },
            },
          },
        },
      }),
      this.prisma.doctor.findMany({
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }],
        take: 4,
      }),
    ]);

    return {
      message: 'Tải dashboard admin thành công!',
      data: {
        stats: {
          userCount,
          doctorCount,
          patientCount,
          appointmentCount,
          prescriptionCount,
          messageCount,
          vitalCount,
        },
        statusStats,
        recentAppointments,
        recentMessages,
        recentPrescriptions,
        recentVitals,
        topDoctors,
      },
    };
  }

  async getPatientDashboard(patientId: number) {
    const resolvedPatientId = await this.resolvePatientId(patientId);
    const patient = await this.prisma.user.findUnique({
      where: { id: resolvedPatientId },
      include: { doctorProfile: true },
    });

    if (!patient || patient.role !== 'PATIENT') {
      throw new NotFoundException('Không tìm thấy bệnh nhân phù hợp!');
    }

    const [appointments, prescriptions, vitals, messages] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { patientId: resolvedPatientId },
        orderBy: { appointmentDate: 'desc' },
        include: {
          doctor: { select: { id: true, fullName: true, email: true } },
          prescriptions: true,
          vitalSigns: true,
          aiSummaries: true,
        },
      }),
      this.prisma.prescription.findMany({
        where: { appointment: { is: { patientId: resolvedPatientId } } },
        orderBy: { createdAt: 'desc' },
        include: {
          appointment: { include: { doctor: { select: { fullName: true } } } },
        },
      }),
      this.prisma.vitalSignsAI.findMany({
        where: { appointment: { is: { patientId: resolvedPatientId } } },
        orderBy: { measuredAt: 'desc' },
        take: 12,
        include: {
          appointment: { include: { doctor: { select: { fullName: true } } } },
        },
      }),
      this.prisma.messageLog.findMany({
        where: { appointment: { is: { patientId: resolvedPatientId } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          sender: { select: { fullName: true, role: true } },
        },
      }),
    ]);

    const upcomingAppointments = appointments.filter((appointment) => appointment.status !== 'COMPLETED').slice(0, 5);
    const completedAppointments = appointments.filter((appointment) => appointment.status === 'COMPLETED');

    return {
      message: 'Tải dashboard bệnh nhân thành công!',
      data: {
        patient: {
          id: patient.id,
          fullName: patient.fullName,
          email: patient.email,
          role: patient.role,
        },
        stats: {
          totalAppointments: appointments.length,
          upcomingAppointments: upcomingAppointments.length,
          completedAppointments: completedAppointments.length,
          prescriptionCount: prescriptions.length,
          vitalCount: vitals.length,
          messageCount: messages.length,
        },
        upcomingAppointments,
        completedAppointments,
        prescriptions,
        vitals,
        messages,
      },
    };
  }

  async getDoctorDashboard(doctorId: number) {
    const resolvedDoctorId = await this.resolveDoctorId(doctorId);
    const doctor = await this.prisma.user.findUnique({
      where: { id: resolvedDoctorId },
      include: { doctorProfile: true },
    });

    if (!doctor || doctor.role !== 'DOCTOR') {
      throw new NotFoundException('Không tìm thấy bác sĩ phù hợp!');
    }

    const [appointments, prescriptions, vitals, messages] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { doctorId: resolvedDoctorId },
        orderBy: { appointmentDate: 'desc' },
        include: {
          patient: { select: { id: true, fullName: true, email: true } },
          prescriptions: true,
          vitalSigns: true,
          aiSummaries: true,
        },
      }),
      this.prisma.prescription.findMany({
        where: { appointment: { is: { doctorId: resolvedDoctorId } } },
        orderBy: { createdAt: 'desc' },
        include: {
          appointment: { include: { patient: { select: { fullName: true } } } },
        },
      }),
      this.prisma.vitalSignsAI.findMany({
        where: { appointment: { is: { doctorId: resolvedDoctorId } } },
        orderBy: { measuredAt: 'desc' },
        take: 12,
        include: {
          appointment: { include: { patient: { select: { fullName: true } } } },
        },
      }),
      this.prisma.messageLog.findMany({
        where: { appointment: { is: { doctorId: resolvedDoctorId } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        include: {
          sender: { select: { fullName: true, role: true } },
        },
      }),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const todaysAppointments = appointments.filter((appointment) => appointment.appointmentDate.toISOString().slice(0, 10) === today);
    const completedAppointments = appointments.filter((appointment) => appointment.status === 'COMPLETED');

    return {
      message: 'Tải dashboard bác sĩ thành công!',
      data: {
        doctor: {
          id: doctor.id,
          fullName: doctor.fullName,
          email: doctor.email,
          role: doctor.role,
        },
        profile: doctor.doctorProfile,
        stats: {
          totalAppointments: appointments.length,
          todayAppointments: todaysAppointments.length,
          completedAppointments: completedAppointments.length,
          prescriptionCount: prescriptions.length,
          vitalCount: vitals.length,
          messageCount: messages.length,
        },
        todaysAppointments,
        completedAppointments,
        prescriptions,
        vitals,
        messages,
      },
    };
  }
}