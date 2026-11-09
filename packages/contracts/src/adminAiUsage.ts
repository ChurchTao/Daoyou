/** Historical row compatibility; current collection and queries use server credentials only. */
export type AiUsageCredentialSource = 'server' | 'byok';

export interface AiUsagePricingSnapshot {
  input: number;
  output: number;
  cachedInput?: number;
  condition?: string;
  source?: string;
  verifiedAt?: string;
}

export interface AdminAiUsageQuery {
  from: string;
  to: string;
  sceneId?: string;
  provider?: string;
  modelId?: string;
  page: number;
  pageSize: number;
}

export interface AiUsageCurrencyTotal {
  currency: string;
  estimatedCost: string;
  steps: number;
}

/** Counts observed model-response steps, not business calls or their outcomes. */
export interface AiUsageTotals {
  steps: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  totalDurationMs: number;
  averageDurationMs: number | null;
  pricedSteps: number;
  unpricedSteps: number;
  costs: AiUsageCurrencyTotal[];
}

export interface AdminAiUsageModelSummary extends AiUsageTotals {
  provider: string;
  modelId: string;
  modelAlias: string | null;
}

export interface AdminAiUsageSceneSummary extends AiUsageTotals {
  sceneId: string;
  models: AdminAiUsageModelSummary[];
}

export interface AdminAiUsageDaySummary extends AiUsageTotals {
  date: string;
}

export interface AdminAiUsageEvent {
  id: string;
  recordedAt: string;
  sceneId: string;
  /** Retained for historical event rows; the current API only returns server usage. */
  credentialSource: AiUsageCredentialSource;
  provider: string;
  modelId: string;
  modelAlias: string | null;
  step: number;
  attempt: number;
  fallback: boolean;
  stream: boolean;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
  durationMs: number;
  finishReason: string;
  estimatedCost: string | null;
  currency: string | null;
  pricingSnapshot: AiUsagePricingSnapshot | null;
}

export interface AdminAiUsageSnapshot {
  generatedAt: string;
  timeZone: 'Asia/Shanghai';
  query: AdminAiUsageQuery;
  overview: AiUsageTotals;
  scenes: AdminAiUsageSceneSummary[];
  daily: AdminAiUsageDaySummary[];
  options: {
    sceneIds: string[];
    providers: string[];
    models: Array<{ provider: string; modelId: string }>;
  };
  events: AdminAiUsageEvent[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminAiUsageResponse {
  success: true;
  data: AdminAiUsageSnapshot;
}
