import type { QiAction } from '@shared/config/qiSystem';
import type { QiLogStatus } from '@shared/types/qi';

export interface QiState {
  current: number;
  max: number;
}

export interface QiLogEntry {
  id: string;
  action: string;
  actionInstanceId: string;
  status: QiLogStatus;
  qiCost: number;
  qiGain: number;
  qiBefore: number;
  qiAfter: number;
  source: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QiLogsResponse {
  logs: QiLogEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QiInsufficientError {
  error: 'QI_INSUFFICIENT';
  message: string;
  required: number;
  current: number;
  action: QiAction;
}

export interface QiRestoreRequest {
  consumableId: string;
}
