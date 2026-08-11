import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConsentsService, CURRENT_POLICY_VERSION } from './consents.service';
import type { PrismaService } from '../prisma.service';

describe('ConsentsService', () => {
  const prisma = {
    appointment: { findUnique: jest.fn() },
    consultationConsent: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const service = new ConsentsService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('rejects consent when the current policy was not explicitly accepted', async () => {
    await expect(
      service.accept(1, 2, {
        consentAccepted: false,
        policyVersion: CURRENT_POLICY_VERSION,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects users who are not participants of the appointment', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 1,
      patientId: 2,
      doctorId: 3,
    });
    await expect(
      service.accept(1, 99, {
        consentAccepted: true,
        policyVersion: CURRENT_POLICY_VERSION,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('stores one versioned consent for a valid participant', async () => {
    prisma.appointment.findUnique.mockResolvedValue({
      id: 1,
      patientId: 2,
      doctorId: 3,
    });
    prisma.consultationConsent.upsert.mockResolvedValue({
      id: 5,
      appointmentId: 1,
      userId: 2,
    });
    const result = await service.accept(1, 2, {
      consentAccepted: true,
      policyVersion: CURRENT_POLICY_VERSION,
    });
    expect(prisma.consultationConsent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { appointmentId_userId: { appointmentId: 1, userId: 2 } },
      }),
    );
    expect(result.data.id).toBe(5);
  });
});
