import type { Cultivator } from './cultivator';
/** Opaque archive retained solely for the deprecated table's JSON column. */
export type BattleRecordV3 = Record<string, unknown>;
export type BattleRecordUnitSummary = Pick<Cultivator, 'id' | 'name'>;
