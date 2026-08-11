import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';

describe('AppointmentsService booking validation', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    doctorSchedule: { findFirst: jest.fn() },
  };
  const gateway = { server: { to: jest.fn() } };
  const service = new AppointmentsService(
    prisma as unknown as PrismaService,
    gateway as unknown as MessagesGateway,
  );

  beforeEach(() => jest.clearAllMocks());

  it('requires an explicitly selected time slot', async () => {
    await expect(
      service.create(
        {
          patientId: 1,
          doctorId: 2,
          appointmentDate: '2026-08-12',
          startTime: '',
          endTime: '',
          symptoms: 'Đau đầu',
        },
        { sub: 1, role: 'PATIENT' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('requires a non-empty symptom description', async () => {
    await expect(
      service.create(
        {
          patientId: 1,
          doctorId: 2,
          appointmentDate: '2026-08-12',
          startTime: '09:00',
          endTime: '09:30',
          symptoms: '   ',
        },
        { sub: 1, role: 'PATIENT' },
      ),
    ).rejects.toThrow('Vui lòng mô tả triệu chứng trước khi đặt lịch.');
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a time that is not in the doctor available schedule', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 1, role: 'PATIENT' })
      .mockResolvedValueOnce({ id: 2, role: 'DOCTOR' });
    prisma.doctorSchedule.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        {
          patientId: 1,
          doctorId: 2,
          appointmentDate: '2026-08-12',
          startTime: '09:00',
          endTime: '09:30',
          symptoms: 'Đau đầu kéo dài hai ngày',
        },
        { sub: 1, role: 'PATIENT' },
      ),
    ).rejects.toThrow('Khung giờ đã chọn không còn trống.');
  });
});
