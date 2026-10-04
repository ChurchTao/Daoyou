import { SectError } from '@server/sects/application/SectError.js';
import { SectIdempotencyKeySchema } from '@daoyou/contracts/sect';
import { createHash } from 'node:crypto';

export type SectCommandRequest = {
  key: string | undefined;
  method: string;
  path: string;
};

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export function requireSectIdempotency(
  request: SectCommandRequest,
  source: string,
  payload: unknown,
) {
  const parsed = SectIdempotencyKeySchema.safeParse(request.key);
  if (!parsed.success)
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      '缺少有效的 Idempotency-Key 请求头',
      400,
    );
  return {
    key: parsed.data,
    fingerprint: createHash('sha256')
      .update(
        `${source}:${request.method}:${request.path}:${canonicalize(payload)}`,
      )
      .digest('hex'),
  };
}
