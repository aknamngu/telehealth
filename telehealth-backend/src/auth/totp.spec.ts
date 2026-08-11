import {
  buildTotpUri,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from './totp';

describe('TOTP helpers', () => {
  it('generates a Google Authenticator compatible secret and URI', () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, 'patient@example.com');

    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain(`secret=${secret}`);
  });

  it('accepts the current code and rejects a wrong code', () => {
    const secret = generateTotpSecret();
    const code = generateTotpCode(secret);

    expect(verifyTotpCode(secret, code)).toBe(true);
    expect(
      verifyTotpCode(secret, code === '000000' ? '111111' : '000000'),
    ).toBe(false);
  });
});
