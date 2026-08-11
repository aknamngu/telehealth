import {
  createPrescriptionVerification,
  verifyPrescriptionIntegrity,
} from './prescription-verification';

describe('prescription verification signature', () => {
  const content = {
    appointmentId: 12,
    doctorId: 4,
    patientId: 9,
    diagnosis: 'Viêm họng cấp',
    medicines: 'Paracetamol 500mg',
  };

  it('accepts an intact prescription signed with the same key', () => {
    const issued = createPrescriptionVerification(content, 'test-signing-key');
    expect(
      verifyPrescriptionIntegrity(
        { ...content, ...issued },
        issued.verificationHash,
        'test-signing-key',
      ),
    ).toBe(true);
  });

  it('detects changed prescription content', () => {
    const issued = createPrescriptionVerification(content, 'test-signing-key');
    expect(
      verifyPrescriptionIntegrity(
        { ...content, ...issued, medicines: 'Nội dung đã bị sửa' },
        issued.verificationHash,
        'test-signing-key',
      ),
    ).toBe(false);
  });
});
