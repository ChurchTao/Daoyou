import type { BattleSaveV1 } from '@shared/engine/battle-v5/persistence/types';
import type {
  BattleRoundResolutionV1,
  RoundCommandSetV1,
} from '@shared/engine/battle-v5/round/types';
import { observeOnlineBattleMetric } from './OnlineBattleMetrics';

type WorkerResponse =
  | {
      readonly id: string;
      readonly ok: true;
      readonly resolution: BattleRoundResolutionV1;
    }
  | {
      readonly id: string;
      readonly ok: false;
      readonly error: string;
      readonly code?: string;
    };

type ResolutionTask = {
  readonly id: string;
  readonly battle: BattleSaveV1;
  readonly commandSet: RoundCommandSetV1;
  readonly enqueuedAt: number;
  readonly resolve: (value: BattleRoundResolutionV1) => void;
  readonly reject: (reason: Error) => void;
  queueTimeout?: ReturnType<typeof setTimeout>;
};

type WorkerSlot = {
  worker: Worker;
  status: 'idle' | 'busy' | 'restarting';
  activeTask?: ResolutionTask;
  executionTimeout?: ReturnType<typeof setTimeout>;
};

const QUEUE_TIMEOUT_MS = 3_000;
const EXECUTION_TIMEOUT_MS = 3_000;
const MAX_QUEUED_RESOLUTIONS = 256;

export interface OnlineBattleRoundResolver {
  resolve(
    battle: BattleSaveV1,
    commandSet: RoundCommandSetV1,
  ): Promise<BattleRoundResolutionV1>;
  close(): void;
}

export type OnlineBattleResolverPoolOptions = {
  readonly size?: number;
  readonly queueTimeoutMs?: number;
  readonly executionTimeoutMs?: number;
  readonly workerUrl?: URL;
};

export type OnlineBattleResolutionFailureKind =
  | 'transient_infrastructure'
  | 'deterministic_game_error';

export class OnlineBattleResolutionError extends Error {
  constructor(
    message: string,
    readonly kind: OnlineBattleResolutionFailureKind,
    readonly code: string,
  ) {
    super(message);
    this.name = 'OnlineBattleResolutionError';
  }
}

export class OnlineBattleResolverPool implements OnlineBattleRoundResolver {
  private readonly slots: WorkerSlot[] = [];
  private readonly queue: ResolutionTask[] = [];
  private stopped = false;

  private readonly queueTimeoutMs: number;
  private readonly executionTimeoutMs: number;
  private readonly workerUrl?: URL;

  constructor(options: number | OnlineBattleResolverPoolOptions = {}) {
    const normalized = typeof options === 'number' ? { size: options } : options;
    const size = normalized.size ?? Math.max(
      1,
      Math.min(
        4,
        typeof navigator === 'undefined'
          ? 2
          : navigator.hardwareConcurrency || 2,
      ),
    );
    if (!Number.isSafeInteger(size) || size < 1 || size > 32) {
      throw new Error('Battle resolver pool size must be between 1 and 32');
    }
    this.queueTimeoutMs = normalized.queueTimeoutMs ?? QUEUE_TIMEOUT_MS;
    this.executionTimeoutMs =
      normalized.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS;
    if (
      !Number.isFinite(this.queueTimeoutMs) ||
      this.queueTimeoutMs <= 0 ||
      !Number.isFinite(this.executionTimeoutMs) ||
      this.executionTimeoutMs <= 0
    ) {
      throw new Error('Battle resolver timeouts must be positive');
    }
    this.workerUrl = normalized.workerUrl;
    for (let index = 0; index < size; index += 1) {
      this.slots.push(this.createSlot());
    }
  }

  resolve(
    battle: BattleSaveV1,
    commandSet: RoundCommandSetV1,
  ): Promise<BattleRoundResolutionV1> {
    if (this.stopped) {
      return Promise.reject(
        transientError('Battle resolver pool is stopped', 'RESOLVER_STOPPED'),
      );
    }
    if (this.queue.length >= MAX_QUEUED_RESOLUTIONS) {
      return Promise.reject(
        transientError('Battle resolver queue is full', 'RESOLVER_QUEUE_FULL'),
      );
    }
    return new Promise((resolve, reject) => {
      const task: ResolutionTask = {
        id: crypto.randomUUID(),
        battle,
        commandSet,
        enqueuedAt: Date.now(),
        resolve,
        reject,
      };
      this.queue.push(task);
      task.queueTimeout = setTimeout(() => {
        const index = this.queue.indexOf(task);
        if (index < 0) return;
        this.queue.splice(index, 1);
        observeOnlineBattleMetric('resolver_timeout_total');
        task.reject(
          transientError(
            'Battle round resolution queue timed out',
            'RESOLVER_QUEUE_TIMEOUT',
          ),
        );
      }, this.queueTimeoutMs);
      this.dispatch();
    });
  }

  close(): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const task of this.queue.splice(0)) {
      if (task.queueTimeout) clearTimeout(task.queueTimeout);
      observeOnlineBattleMetric(
        'resolver_queue_wait_ms',
        Math.max(0, Date.now() - task.enqueuedAt),
      );
      task.reject(transientError('Battle resolver pool stopped', 'RESOLVER_STOPPED'));
    }
    for (const slot of this.slots) {
      if (slot.executionTimeout) clearTimeout(slot.executionTimeout);
      slot.activeTask?.reject(
        transientError('Battle resolver pool stopped', 'RESOLVER_STOPPED'),
      );
      slot.activeTask = undefined;
      slot.status = 'restarting';
      slot.worker.terminate();
    }
  }

  private createSlot(): WorkerSlot {
    const url = this.workerUrl ?? (import.meta.env.PROD
      ? new URL('./online-battle-resolver.js', import.meta.url)
      : new URL('../../workers/onlineBattleResolver.worker.ts', import.meta.url));
    const slot = {
      worker: new Worker(url.href, { type: 'module' }),
      status: 'idle',
    } satisfies WorkerSlot;
    this.bindWorker(slot);
    return slot;
  }

  private bindWorker(slot: WorkerSlot): void {
    slot.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const task = slot.activeTask;
      if (!task || event.data?.id !== task.id) {
        this.failSlot(slot, 'Resolver worker returned an invalid response', 'RESOLVER_INVALID_RESPONSE');
        return;
      }
      this.clearActive(slot);
      if (event.data.ok) {
        task.resolve(event.data.resolution);
      } else {
        task.reject(
          new OnlineBattleResolutionError(
            event.data.error,
            'deterministic_game_error',
            event.data.code ?? 'BATTLE_ROUND_RESOLUTION_FAILED',
          ),
        );
      }
      this.dispatch();
    };
    slot.worker.onerror = () => {
      this.failSlot(slot, 'Resolver worker crashed', 'RESOLVER_WORKER_ERROR');
    };
    slot.worker.onmessageerror = () => {
      this.failSlot(
        slot,
        'Resolver worker message could not be decoded',
        'RESOLVER_MESSAGE_ERROR',
      );
    };
  }

  private dispatch(): void {
    if (this.stopped) return;
    for (const slot of this.slots) {
      if (slot.status !== 'idle') continue;
      const task = this.queue.shift();
      if (!task) return;
      if (task.queueTimeout) clearTimeout(task.queueTimeout);
      slot.status = 'busy';
      slot.activeTask = task;
      slot.executionTimeout = setTimeout(() => {
        this.failSlot(
          slot,
          'Battle round resolution execution timed out',
          'RESOLVER_EXECUTION_TIMEOUT',
        );
      }, this.executionTimeoutMs);
      slot.worker.postMessage({
        id: task.id,
        battle: task.battle,
        commandSet: task.commandSet,
      });
    }
  }

  private failSlot(slot: WorkerSlot, message: string, code: string): void {
    if (this.stopped || slot.status === 'restarting') return;
    const task = slot.activeTask;
    this.clearActive(slot);
    slot.status = 'restarting';
    slot.worker.terminate();
    observeOnlineBattleMetric('resolver_worker_restart_total');
    if (code.includes('TIMEOUT')) {
      observeOnlineBattleMetric('resolver_timeout_total');
    }
    task?.reject(transientError(message, code));
    const replacement = this.createSlot();
    const index = this.slots.indexOf(slot);
    if (index >= 0) this.slots[index] = replacement;
    this.dispatch();
  }

  private clearActive(slot: WorkerSlot): void {
    if (slot.executionTimeout) clearTimeout(slot.executionTimeout);
    slot.executionTimeout = undefined;
    slot.activeTask = undefined;
    slot.status = 'idle';
  }
}

function transientError(message: string, code: string): OnlineBattleResolutionError {
  return new OnlineBattleResolutionError(
    message,
    'transient_infrastructure',
    code,
  );
}
