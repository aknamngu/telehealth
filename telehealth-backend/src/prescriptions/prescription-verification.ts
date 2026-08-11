import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface PrescriptionIntegrityData {
  appointmentId: number;
  doctorId: number;
  patientId: number;
  diagnosis: string;
  medicines: string;
  verificationToken: string;
  issuedAt: Date;
}

function canonicalPayload(data: PrescriptionIntegrityData) {
  return [
    data.appointmentId,
    data.doctorId,
    data.patientId,
    data.diagnosis.trim(),
    data.medicines.trim(),
    data.verificationToken,
    data.issuedAt.toISOString(),
  ].join('\n');
}

export function createPrescriptionVerification(
  data: Omit<PrescriptionIntegrityData, 'verificationToken' | 'issuedAt'>,
  secret: string,
) {
  const verificationToken = randomBytes(24).toString('base64url');
  const issuedAt = new Date();
  const verificationHash = createHmac('sha256', secret)
    .update(canonicalPayload({ ...data, verificationToken, issuedAt }))
    .digest('hex');

  return { verificationToken, verificationHash, issuedAt };
}

export function verifyPrescriptionIntegrity(
  data: PrescriptionIntegrityData,
  expectedHash: string,
  secret: string,
) {
  const actualHash = createHmac('sha256', secret)
    .update(canonicalPayload(data))
    .digest();
  const expected = Buffer.from(expectedHash, 'hex');
  return (
    expected.length === actualHash.length &&
    timingSafeEqual(actualHash, expected)
  );
}
