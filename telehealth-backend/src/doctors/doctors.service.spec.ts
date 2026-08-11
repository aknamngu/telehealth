import { DoctorsService } from './doctors.service';
import { PrismaService } from '../prisma.service';

describe('DoctorsService default schedules', () => {
  const prisma = {
    appointment: { findMany: jest.fn() },
    doctorSchedule: { findMany: jest.fn() },
  };
  const service = new DoctorsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('returns eight one-hour slots and excludes the lunch break', async () => {
    prisma.appointment.findMany.mockResolvedValue([]);

    const result = await service.getSchedules(4, '2099-08-12');

    expect(result.data).toHaveLength(8);
    expect(result.data.map((slot) => slot.startTime)).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ]);
  });

  it('marks only the booked slot of the selected doctor and date', async () => {
    prisma.appointment.findMany.mockResolvedValue([{ startTime: '14:00' }]);

    const result = await service.getSchedules(7, '2099-08-13');
    const booked = result.data.filter((slot) => slot.isBooked);

    expect(booked.map((slot) => slot.startTime)).toEqual(['14:00']);
    expect(prisma.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ doctorId: 7 }),
      }),
    );
  });
});
