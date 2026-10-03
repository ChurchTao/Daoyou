import type {
  SectTaskAvailabilityDecision,
  SectTaskDefinition,
} from '@daoyou/shared/engine/sect';
import { SectError } from '@server/sects/application/SectError.js';
import type { SectMembershipRecord, SectQueryContext } from '@server/sects/organization/ports.js';

export function invalidSectTask(message: string, status = 409): never {
  throw new SectError('SECT_ORGANIZATION_INVALID', message, status);
}

export function sectTaskPeriodKey(
  definition: SectTaskDefinition,
  context: Pick<SectQueryContext, 'clock'>,
): string {
  if (definition.kind === 'daily') return context.clock.dateKey();
  if (definition.kind === 'weekly') return context.clock.weekKey();
  return 'permanent';
}

export function resolveCurrentSectTaskExecution(
  definition: SectTaskDefinition,
  context: Pick<SectQueryContext, 'clock'>,
): SectTaskAvailabilityDecision {
  if (!definition.availability)
    return {
      key: 'default',
      executorKey: definition.executorKey,
      offer: definition.offer,
    };
  const variantKey = definition.availability.resolve({
    dateKey: context.clock.dateKey(),
    weekKey: context.clock.weekKey(),
  });
  const variant = definition.availability.variants.find(
    (candidate) => candidate.key === variantKey,
  );
  if (!variant)
    invalidSectTask(
      `任务 ${definition.id} 返回未声明的执行变体：${variantKey}`,
      500,
    );
  return {
    ...variant,
    offer: variant.offer ?? definition.offer,
  };
}

export async function requireSectMembership(
  cultivatorId: string,
  context: Pick<SectQueryContext, 'memberships'>,
): Promise<SectMembershipRecord> {
  const membership = await context.memberships.findByCultivator(cultivatorId);
  if (!membership) invalidSectTask('尚未拜入宗门');
  return membership;
}
