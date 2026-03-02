import {
  generateRedeemCode,
  isValidRedeemCodeFormat,
  normalizeRedeemCode,
} from './code';

describe('redeem code utils', () => {
  it('normalizes code to uppercase and trims spaces', () => {
    expect(normalizeRedeemCode('  ab12cd  ')).toBe('AB12CD');
  });

  it('validates expected format', () => {
    expect(isValidRedeemCodeFormat('AB12CD')).toBe(true);
    expect(isValidRedeemCodeFormat('A B12CD')).toBe(false);
    expect(isValidRedeemCodeFormat('abc123')).toBe(false);
    expect(isValidRedeemCodeFormat('AB12')).toBe(false);
  });

  it('generates code with expected length and charset', () => {
    const code = generateRedeemCode();
    expect(code).toHaveLength(12);
    expect(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/.test(code)).toBe(true);
  });
});
