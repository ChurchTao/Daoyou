/** Historical snapshots only. Never compile these facts into combat abilities. */
export type LegacyProductType = 'artifact' | 'skill' | 'gongfa';
export interface LegacyAttributeModifier {
  attrType: string;
  type: string;
  value: number;
  scaleByLayer?: boolean;
  valueByLayer?: readonly number[];
}
export interface LegacyAbilitySnapshot {
  slug?: string;
  name?: string;
  modifiers?: LegacyAttributeModifier[];
  mpCost?: number;
  cooldown?: number;
  [key: string]: unknown;
}
export function legacyRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function legacyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
export function legacyModifiers(value: unknown): LegacyAttributeModifier[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = legacyRecord(entry);
    return typeof row.attrType === 'string' &&
      typeof row.type === 'string' &&
      typeof row.value === 'number' &&
      Number.isFinite(row.value)
      ? [{ attrType: row.attrType, type: row.type, value: row.value }]
      : [];
  });
}
/** Preserve the attachment snapshot without rebuilding or stripping historical facts. */
export function legacyProductForGrant(value: unknown): Record<string, unknown> {
  const record = legacyRecord(value);
  if (!['artifact', 'skill', 'gongfa'].includes(String(record.productType)))
    throw new Error('历史产物缺少有效存档');
  const { battleProjection: _projection, ...stored } = record;
  void _projection;
  return stored;
}
