import { inventoryStackIdentity } from '@shared/inventory/stack-key';
import { createHash } from 'node:crypto';

export function inventoryStackKey(
  definitionId: string,
  data: unknown,
): string | null {
  const identity = inventoryStackIdentity(definitionId, data);
  return definitionId === 'material.v1'
    ? `material.v1:${createHash('sha256').update(identity!).digest('hex')}`
    : identity;
}
