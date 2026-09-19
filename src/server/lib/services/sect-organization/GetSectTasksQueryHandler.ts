import type { SectTasksData, SectTaskViewData } from '@shared/contracts/sect';
import { SectCapabilityAuthorizer } from './SectCapabilityAuthorizer';
import {
  requireSectMembership,
  resolveCurrentSectTaskExecution,
  sectTaskPeriodKey,
} from './SectTaskApplicationSupport';
import {
  toSectTaskView,
  toUnpersistedSectTaskView,
} from './SectTaskViewAssembler';
import type { SectQueryContext } from './ports';
import type { SectTaskExecutorRegistry } from './task-executors/SectTaskExecutor';

export class GetSectTasksQueryHandler {
  constructor(
    private readonly executors: SectTaskExecutorRegistry,
    private readonly authorizer = new SectCapabilityAuthorizer(),
  ) {}

  async execute(
    input: { cultivatorId: string },
    context: SectQueryContext,
  ): Promise<SectTasksData> {
    const membership = await requireSectMembership(input.cultivatorId, context);
    const organization = context.modules.require(membership.sectId);
    this.authorizer.assertOrganization(
      organization,
      membership.discipleRank,
      'sect.tasks.use',
    );
    const dateKey = context.clock.dateKey();
    const weekKey = context.clock.weekKey();
    const now = context.clock.now();
    const records = await context.tasks.list(membership.id, [
      dateKey,
      weekKey,
      'permanent',
    ]);
    const definitions = [
      ...organization.tasks.listDaily(),
      ...organization.tasks.listWeekly(),
      ...organization.tasks.listPromotion(),
    ];
    const items = await Promise.all(
      definitions.map(async (definition): Promise<SectTaskViewData> => {
        const periodKey = sectTaskPeriodKey(definition, context);
        const pendingBattle = records.find((record) => record.taskId === definition.id &&
          (record.payload.executorData.battleSettled === false ||
            (record.periodKey !== periodKey && record.status === 'completed' && !record.claimedAt)));
        const persisted = pendingBattle ?? records.find(
          (record) =>
            record.taskId === definition.id &&
            record.periodKey === periodKey &&
            record.status !== 'abandoned',
        );
        if (!persisted && definition.enrollment === 'manual') {
          const capability = definition.requiredCapability;
          const enabled = organization.capabilities.allows(
            membership.discipleRank,
            capability,
          );
          const permission = organization.capabilities.snapshot(
            membership.discipleRank,
          )[capability];
          return toUnpersistedSectTaskView({
            definition,
            periodKey,
            state: enabled ? 'offered' : 'locked',
            enabled,
            disabledReason: enabled
              ? undefined
              : (permission?.reason ?? '当前弟子职阶尚未开放'),
          });
        }
        const currentExecution = persisted
          ? undefined
          : resolveCurrentSectTaskExecution(definition, context);
        const executor = this.executors.require(
          persisted?.payload.offer.executorKey ?? currentExecution!.executorKey,
        );
        const capability = executor.requiredCapability(definition);
        const enabled = organization.capabilities.allows(
          membership.discipleRank,
          capability,
        );
        const permission = organization.capabilities.snapshot(
          membership.discipleRank,
        )[capability];
        if (!persisted) {
          return toUnpersistedSectTaskView({
            definition,
            periodKey,
            state: enabled ? 'active' : 'locked',
            executor,
            enabled,
            disabledReason: enabled
              ? undefined
              : (permission?.reason ?? '当前弟子职阶尚未开放'),
          });
        }
        const state: SectTaskViewData['state'] = !enabled
          ? 'locked'
          : persisted?.status === 'completed'
            ? persisted.claimedAt
              ? 'claimed'
              : 'claimable'
            : 'active';
        return toSectTaskView({
          definition,
          record: persisted,
          executor,
          now,
          state,
          enabled,
          disabledReason: enabled
            ? undefined
            : (permission?.reason ?? '当前弟子职阶尚未开放'),
        });
      }),
    );
    return { dateKey, weekKey, items };
  }
}
