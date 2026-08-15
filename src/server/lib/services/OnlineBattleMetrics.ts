export type OnlineBattleMetricName =
  | 'resolve_duration_ms'
  | 'resolver_queue_wait_ms'
  | 'resolver_worker_restart_total'
  | 'resolver_timeout_total'
  | 'resolution_retry_total'
  | 'resolution_failed_total'
  | 'scheduler_lag_ms'
  | 'cas_conflict_total'
  | 'result_payload_bytes'
  | 'snapshot_payload_bytes'
  | 'event_snapshot_bytes'
  | 'event_snapshot_miss_total'
  | 'presentation_boundary_resync_total'
  | 'reconnect_revision_gap'
  | 'client_event_gap_total'
  | 'default_action_total'
  | 'ready_wait_ms'
  | 'presentation_forced_end_total'
  | 'terminal_cleanup_retry_total'
  | 'terminal_cleanup_completed_total'
  | 'terminal_cleanup_failed_total'
  | 'nats_event_lag_ms';
export type OnlineBattleGaugeName =
  | 'terminal_cleanup_pending'
  | 'terminal_cleanup_age_ms'
  | 'terminal_outbox_pending';

type MetricSummary = {
  count: number;
  sum: number;
  min: number;
  max: number;
  last: number;
  lastRecordedAt: number;
};

export type OnlineBattleOperatorAction = {
  readonly action: 'retry_resolution' | 'technical_abort';
  readonly operatorId: string;
  readonly matchId: string;
  readonly changed: boolean;
  readonly fingerprint?: string;
  readonly attempt?: number;
  readonly recordedAt: number;
};

const summaries = new Map<OnlineBattleMetricName, MetricSummary>();
const gauges = new Map<OnlineBattleGaugeName, { value: number; recordedAt: number }>();
const recentOperatorActions: OnlineBattleOperatorAction[] = [];
const MAX_OPERATOR_ACTIONS = 100;

export function observeOnlineBattleMetric(
  name: OnlineBattleMetricName,
  value = 1,
): void {
  if (!Number.isFinite(value)) return;
  const now = Date.now();
  const current = summaries.get(name);
  summaries.set(name, current
    ? {
        count: current.count + 1,
        sum: current.sum + value,
        min: Math.min(current.min, value),
        max: Math.max(current.max, value),
        last: value,
        lastRecordedAt: now,
      }
    : {
        count: 1,
        sum: value,
        min: value,
        max: value,
        last: value,
        lastRecordedAt: now,
      });
}

export function setOnlineBattleMetricGauge(
  name: OnlineBattleGaugeName,
  value: number,
): void {
  if (Number.isFinite(value)) gauges.set(name, { value, recordedAt: Date.now() });
}

export function recordOnlineBattleOperatorAction(
  action: OnlineBattleOperatorAction,
): void {
  recentOperatorActions.push(action);
  if (recentOperatorActions.length > MAX_OPERATOR_ACTIONS) {
    recentOperatorActions.splice(0, recentOperatorActions.length - MAX_OPERATOR_ACTIONS);
  }
}

export function getOnlineBattleMetricsSnapshot() {
  return {
    generatedAt: Date.now(),
    processScoped: true,
    metrics: Object.fromEntries(
      [...summaries.entries()].map(([name, summary]) => [name, {
        ...summary,
        average: summary.count > 0 ? summary.sum / summary.count : 0,
      }]),
    ),
    gauges: Object.fromEntries(gauges),
    recentOperatorActions: [...recentOperatorActions].reverse(),
  };
}
