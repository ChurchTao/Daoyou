import type { QiAction } from './actions.js';

export const QI_LOG_STATUS_VALUES = [
  'reserved',
  'committed',
  'failed_no_refund',
  'refunded',
  'restore_committed',
] as const;

export type QiLogStatus = (typeof QI_LOG_STATUS_VALUES)[number];

export const QI_RESTORE_SOURCE_VALUES = [
  'talisman',
  'gm',
  'compensation',
] as const;

export type QiRestoreSource = (typeof QI_RESTORE_SOURCE_VALUES)[number];

export interface QiLogMetadata {
  [key: string]: unknown;
}

export interface QiProjectionBaseline {
  qi: number;
  qiLastRefreshedAt: string | null;
}

export interface QiReservationResult {
  success: boolean;
  action: QiAction;
  actionInstanceId: string;
  qiBefore: number;
  qiAfter: number;
  qiLastRefreshedAt: string | null;
  consumed: number;
}

export interface QiRestoreResult {
  success: boolean;
  qiBefore: number;
  qiAfter: number;
  qiLastRefreshedAt: string | null;
  restored: number;
  overflowMax: number;
}
