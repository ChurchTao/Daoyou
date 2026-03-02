const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const DEFAULT_CODE_LENGTH = 12;

export function normalizeRedeemCode(input: string): string {
  return input.trim().toUpperCase();
}

export function isValidRedeemCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{6,64}$/.test(code);
}

export function generateRedeemCode(length = DEFAULT_CODE_LENGTH): string {
  const size = Number.isFinite(length) ? Math.floor(length) : DEFAULT_CODE_LENGTH;
  const finalLength = Math.min(Math.max(size, 6), 64);
  let result = '';
  for (let i = 0; i < finalLength; i += 1) {
    const index = Math.floor(Math.random() * CODE_CHARSET.length);
    result += CODE_CHARSET[index];
  }
  return result;
}
