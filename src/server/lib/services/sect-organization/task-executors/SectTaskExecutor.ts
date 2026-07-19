import type {
  SectPermission,
  SectTaskDefinition,
  SectTaskExecutorKind,
} from '@shared/engine/sect';

export interface SectTaskAcceptanceContext {
  seed: number;
}

export interface SectTaskExecutor {
  readonly kind: SectTaskExecutorKind | readonly SectTaskExecutorKind[];
  requiredPermission(definition: SectTaskDefinition): SectPermission;
  acceptancePayload(
    definition: SectTaskDefinition,
    context: SectTaskAcceptanceContext,
  ): Record<string, unknown>;
}

export class SweepGameTaskExecutor implements SectTaskExecutor {
  readonly kind = 'sweep' as const;
  requiredPermission(): SectPermission {
    return 'scene.affairs';
  }
  acceptancePayload(): Record<string, unknown> {
    return { target: 1 };
  }
}

export class BattleTaskExecutor implements SectTaskExecutor {
  readonly kind = 'battle' as const;
  requiredPermission(definition: SectTaskDefinition): SectPermission {
    return definition.kind === 'promotion' ? 'task.elder_trial' : 'scene.affairs';
  }
  acceptancePayload(): Record<string, unknown> {
    return { target: 1 };
  }
}

export class ItemDeliveryTaskExecutor implements SectTaskExecutor {
  readonly kind = ['submit_pill', 'submit_artifact', 'submit_material'] as const;
  requiredPermission(definition: SectTaskDefinition): SectPermission {
    const executor = definition.executor === 'battle'
      ? definition.alternateExecutor
      : definition.executor;
    return executor === 'submit_pill'
      ? 'task.pill_delivery'
      : executor === 'submit_artifact'
        ? 'task.artifact_delivery'
        : 'scene.affairs';
  }
  acceptancePayload(
    definition: SectTaskDefinition,
    context: SectTaskAcceptanceContext,
  ): Record<string, unknown> {
    return {
      target: 1,
      minQuality: '凡品',
      quantity: 1,
      ...(definition.executor === 'submit_pill'
        ? { pillFamily: context.seed % 2 === 0 ? 'healing' : 'mana' }
        : {}),
    };
  }
}

export class ProgressTaskExecutor implements SectTaskExecutor {
  readonly kind = 'progress' as const;
  requiredPermission(): SectPermission {
    return 'scene.affairs';
  }
  acceptancePayload(definition: SectTaskDefinition): Record<string, unknown> {
    return { target: definition.target };
  }
}

export class SectTaskExecutorRegistry {
  private readonly executors = new Map<SectTaskExecutorKind, SectTaskExecutor>();

  constructor(executors: readonly SectTaskExecutor[]) {
    for (const executor of executors) {
      const kinds = Array.isArray(executor.kind) ? executor.kind : [executor.kind];
      for (const kind of kinds) this.executors.set(kind, executor);
    }
  }

  require(kind: SectTaskExecutorKind): SectTaskExecutor {
    const executor = this.executors.get(kind);
    if (!executor) throw new Error(`未注册宗门任务执行器：${kind}`);
    return executor;
  }
}

export const sectTaskExecutorRegistry = new SectTaskExecutorRegistry([
  new SweepGameTaskExecutor(),
  new BattleTaskExecutor(),
  new ItemDeliveryTaskExecutor(),
  new ProgressTaskExecutor(),
]);
