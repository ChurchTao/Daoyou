import {
  RESOURCE_DATA_SCHEMAS,
} from '@shared/contracts/resources';
import {
  SectTaskSubmissionInputSchema,
  type SectTaskActionOutcome,
  type SectTaskSubmissionInput,
} from '@shared/contracts/sect';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import {
  describeSectDeliveryRequirement,
  matchSectDeliveryRequirement,
  matchSectMaterialDeliverySelection,
  MINING_DURATION_MS,
  MINING_MAX_CASTS,
  MINING_RULES_VERSION,
  MINING_SCORE_TIERS,
  MINING_SESSION_TTL_MS,
  MINING_TIER_MATERIAL_QUANTITY,
  miningRewardQualityPreference,
  resolveSectBattleTargetRealmCandidates,
  resolveSectTaskExecutionLocationParameters,
  scaleMiningTaskReward,
  SECT_BATTLE_TARGET_SCHEMA_VERSION,
  SectBattleTargetSnapshotSchema,
  SectTaskRecordPayloadSchema,
  SectTaskRewardSnapshotSchema,
  simulateMiningTranscript,
  simulateSweepMoves,
  summarizeMiningCatches,
  SWEEP_DIRECTIONS,
  SWEEP_MAX_MOVES,
  SWEEP_RULES_VERSION,
  type SectSubmissionItemFacts,
  type SectTaskDefinition,
  type SectTaskRecordPayload,
  type SweepDirection,
} from '@shared/engine/sect';
import { z, type ZodType } from 'zod';
import { SectError } from '../../SectError';
import type {
  SectCommandContext,
  SectMembershipRecord,
  SectTaskRecord,
} from '../ports';
import {
  emptySectCommandEffects,
  mergeSectCommandEffects,
  type SectCommandEffects,
} from '../SectCommandEffects';

export interface SectTaskActionDescriptor {
  key: string;
  renderer: string;
  label: string;
  parameters?: Record<string, unknown>;
}

export interface SectTaskExecutionContext {
  userId: string;
  cultivatorId: string;
  requestId: string;
  membership: SectMembershipRecord;
  record: SectTaskRecord;
  definition: SectTaskDefinition;
  ports: SectCommandContext;
}

export interface SectTaskEnrollmentContext {
  userId: string;
  cultivatorId: string;
  requestId: string;
  membership: SectMembershipRecord;
  definition: SectTaskDefinition;
  payload: SectTaskRecordPayload;
  ports: SectCommandContext;
}

export type SectTaskCompletionSettlement = 'deferred' | 'claim-reward';

export interface SectTaskExecutionDecision {
  completed: boolean;
  /**
   * Controls what the application layer does after a successful completion.
   * Executors declare the interaction semantic; the handler owns fulfillment
   * and reward transactions.
   */
  completionSettlement: SectTaskCompletionSettlement;
  outcome: SectTaskActionOutcome;
  payload?: SectTaskRecordPayload;
  effects?: SectCommandEffects;
}

export interface SectTaskExecutor<TInput = unknown> {
  readonly key: string;
  inputSchema(actionKey: string): ZodType<TInput>;
  requiredCapability(definition: SectTaskDefinition): string;
  actions(definition: SectTaskDefinition): readonly SectTaskActionDescriptor[];
  initializePayload(
    context: SectTaskEnrollmentContext,
  ): Promise<SectTaskRecordPayload>;
  execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: TInput,
  ): Promise<SectTaskExecutionDecision>;
}

function invalid(message: string, status = 400): never {
  throw new SectError('SECT_ORGANIZATION_INVALID', message, status);
}

const emptyInput = z.object({}).strict();
const sweepCompleteInput = z.object({
  sessionId: z.string().uuid(),
  rulesVersion: z.number().int().positive(),
  moves: z.array(z.enum(SWEEP_DIRECTIONS)).min(1).max(SWEEP_MAX_MOVES),
});
const miningCastInput = z
  .object({
    atMs: z
      .number()
      .int()
      .min(0)
      .max(MINING_DURATION_MS - 1),
    angleMilliDegrees: z.number().int().min(-70_000).max(70_000),
  })
  .strict();
const miningCompleteInput = z
  .object({
    sessionId: z.string().uuid(),
    rulesVersion: z.literal(MINING_RULES_VERSION),
    casts: z.array(miningCastInput).max(MINING_MAX_CASTS),
  })
  .strict();
const miningMaterialCandidateSchema = z
  .object({
    libraryItemId: z.string().min(1).max(120),
    name: z.string().min(1).max(100),
    quality: z.enum([
      '凡品',
      '灵品',
      '玄品',
      '真品',
      '地品',
      '天品',
      '仙品',
      '神品',
    ]),
    type: z.literal('ore'),
    element: z.string().min(1).max(10).optional(),
    description: z.string().min(1).max(500),
  })
  .strict();
const miningSessionSchema = z
  .object({
    sessionId: z.string().uuid(),
    seed: z.string().min(1),
    rulesVersion: z.literal(MINING_RULES_VERSION),
    startedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    rewardCandidates: z.record(
      z.enum(MINING_SCORE_TIERS),
      miningMaterialCandidateSchema,
    ),
  })
  .strict();

abstract class BaseTaskExecutor<
  TInput = unknown,
> implements SectTaskExecutor<TInput> {
  abstract readonly key: string;
  abstract inputSchema(actionKey: string): ZodType<TInput>;
  abstract actions(
    definition: SectTaskDefinition,
  ): readonly SectTaskActionDescriptor[];
  abstract execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: TInput,
  ): Promise<SectTaskExecutionDecision>;

  requiredCapability(definition: SectTaskDefinition): string {
    return definition.requiredCapability;
  }

  async initializePayload(
    context: SectTaskEnrollmentContext,
  ): Promise<SectTaskRecordPayload> {
    return context.payload;
  }
}

export class SweepGameTaskExecutor extends BaseTaskExecutor<
  Record<string, unknown>
> {
  readonly key = 'sect.sweep';

  inputSchema(actionKey: string): ZodType<Record<string, unknown>> {
    if (actionKey === 'start') return emptyInput;
    if (actionKey === 'complete') return sweepCompleteInput;
    return z.never();
  }

  actions(definition: SectTaskDefinition): readonly SectTaskActionDescriptor[] {
    return [
      {
        key: 'enter',
        renderer: 'sect.action.sweep-entry',
        label: definition.presentation.actionLabel,
      },
    ];
  }

  async execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SectTaskExecutionDecision> {
    if (actionKey === 'start') {
      const sessionId = context.ports.ids.next();
      const seed = `${context.record.id}:${sessionId}`;
      const startedAt = context.ports.clock.now();
      const expiresAt = new Date(startedAt.getTime() + 10 * 60 * 1_000);
      const payload = {
        ...context.record.payload,
        executorData: {
          ...context.record.payload.executorData,
          sweepSession: {
            sessionId,
            seed,
            rulesVersion: SWEEP_RULES_VERSION,
            startedAt: startedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        },
      };
      return {
        completed: false,
        completionSettlement: 'deferred',
        payload,
        outcome: {
          renderer: 'sect.outcome.sweep-session',
          data: {
            sessionId,
            seed,
            rulesVersion: SWEEP_RULES_VERSION,
            expiresAt: expiresAt.toISOString(),
          },
        },
      };
    }
    if (actionKey !== 'complete') invalid('清扫任务不支持该操作');
    const completeInput = input as z.infer<typeof sweepCompleteInput>;
    const session = (context.record.payload.executorData.sweepSession ??
      {}) as Record<string, unknown>;
    if (session.sessionId !== completeInput.sessionId)
      invalid('清扫场次与当前任务不匹配');
    if (
      session.rulesVersion !== completeInput.rulesVersion ||
      completeInput.rulesVersion !== SWEEP_RULES_VERSION
    )
      invalid('清扫规则版本已更新，请重新开始');
    const now = context.ports.clock.now();
    if (
      typeof session.expiresAt !== 'string' ||
      new Date(session.expiresAt) < now
    )
      invalid('清扫场次已过期，请重新开始');
    if (typeof session.seed !== 'string') invalid('清扫场次数据缺失');
    const simulation = simulateSweepMoves(
      session.seed,
      completeInput.moves as SweepDirection[],
    );
    if (!simulation.success) {
      if (simulation.reason === 'leaves_remaining')
        invalid('云阶尚有落叶未清理干净');
      if (simulation.reason === 'not_at_end') invalid('尚未抵达山门终点');
      if (simulation.reason === 'end_too_early')
        invalid('尚未收齐落叶便踏入了终点');
      if (simulation.reason === 'dead_end') invalid('清扫路线已无路可走');
      invalid('清扫路线无效，请重新挑战');
    }
    return {
      completed: true,
      completionSettlement: 'deferred',
      outcome: { renderer: 'sect.outcome.fulfilled', data: { success: true } },
    };
  }
}

export class MiningGameTaskExecutor extends BaseTaskExecutor<
  Record<string, unknown>
> {
  readonly key = 'sect.mining';

  inputSchema(actionKey: string): ZodType<Record<string, unknown>> {
    if (actionKey === 'start') return emptyInput;
    if (actionKey === 'complete')
      return miningCompleteInput as ZodType<Record<string, unknown>>;
    return z.never();
  }

  actions(definition: SectTaskDefinition): readonly SectTaskActionDescriptor[] {
    return [
      {
        key: 'enter',
        renderer: 'sect.action.mining-entry',
        label: definition.presentation.actionLabel,
      },
    ];
  }

  async execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SectTaskExecutionDecision> {
    if (actionKey === 'start') return this.start(context);
    if (actionKey !== 'complete') invalid('灵矿采掘不支持该操作');
    return this.complete(context, input as z.infer<typeof miningCompleteInput>);
  }

  private async start(
    context: SectTaskExecutionContext,
  ): Promise<SectTaskExecutionDecision> {
    const baseReward = context.record.payload.offer.reward;
    if (!baseReward) invalid('灵矿采掘奖励配置缺失', 500);
    const sessionId = context.ports.ids.next();
    const seed = `${context.record.id}:${sessionId}`;
    const startedAt = context.ports.clock.now();
    const expiresAt = new Date(startedAt.getTime() + MINING_SESSION_TTL_MS);
    const realm = context.record.payload.offer.anchorRealm;
    const rewardCandidateEntries = [];
    for (const tier of MINING_SCORE_TIERS) {
      const preferred = miningRewardQualityPreference(realm, tier);
      const candidate = await context.ports.rewardMaterials.sampleOre(
        preferred,
        `${seed}:${tier}`,
      );
      if (!candidate)
        invalid('宗门材料库暂无可供采掘结算的灵矿，请稍后再试', 503);
      rewardCandidateEntries.push([tier, candidate] as const);
    }
    const rewardCandidates = Object.fromEntries(rewardCandidateEntries);
    const session = miningSessionSchema.parse({
      sessionId,
      seed,
      rulesVersion: MINING_RULES_VERSION,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      rewardCandidates,
    });
    return {
      completed: false,
      completionSettlement: 'deferred',
      payload: {
        ...context.record.payload,
        executorData: {
          ...context.record.payload.executorData,
          miningSession: session,
        },
      },
      outcome: {
        renderer: 'sect.outcome.mining-session',
        data: {
          sessionId,
          seed,
          rulesVersion: MINING_RULES_VERSION,
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
          durationMs: MINING_DURATION_MS,
        },
      },
    };
  }

  private async complete(
    context: SectTaskExecutionContext,
    input: z.infer<typeof miningCompleteInput>,
  ): Promise<SectTaskExecutionDecision> {
    const parsedSession = miningSessionSchema.safeParse(
      context.record.payload.executorData.miningSession,
    );
    if (!parsedSession.success) invalid('灵矿采掘场次数据缺失');
    const session = parsedSession.data;
    if (session.sessionId !== input.sessionId)
      invalid('灵矿采掘场次与当前任务不匹配');
    const now = context.ports.clock.now();
    if (new Date(session.expiresAt) < now)
      invalid('灵矿采掘场次已过期，请重新开始');
    const simulation = simulateMiningTranscript(session.seed, input.casts);
    if (!simulation.valid) {
      const messages = {
        too_many_casts: '灵索下钩次数超过上限',
        invalid_time: '灵索采掘时序无效',
        invalid_angle: '灵索下钩角度无效',
        hook_busy: '上一道灵索尚未收回',
      } as const;
      invalid(
        simulation.reason
          ? messages[simulation.reason]
          : '灵矿采掘记录无法验收',
      );
    }
    const elapsedMs = now.getTime() - new Date(session.startedAt).getTime();
    if (elapsedMs + 1_500 < simulation.completedAtMs)
      invalid('本轮灵矿采掘尚未结束');

    const outcomeBase = {
      score: simulation.score,
      maxScore: simulation.maxScore,
      ratio: simulation.ratio,
      qualified: simulation.qualified,
      collected: simulation.collectedOreIds.length,
      destroyed: simulation.destroyedOreIds.length,
      clearedAll: simulation.clearedAll,
      ores: summarizeMiningCatches(simulation.catches),
    };
    if (!simulation.tier)
      return {
        completed: false,
        completionSettlement: 'deferred',
        outcome: {
          renderer: 'sect.outcome.mining-result',
          data: outcomeBase,
        },
      };

    const baseReward = context.record.payload.offer.reward;
    if (!baseReward) invalid('灵矿采掘奖励配置缺失', 500);
    const candidate = session.rewardCandidates[simulation.tier];
    const numeric = scaleMiningTaskReward(baseReward, simulation.tier);
    const quantity = MINING_TIER_MATERIAL_QUANTITY[simulation.tier];
    const reward = SectTaskRewardSnapshotSchema.parse({
      ...baseReward,
      ...numeric,
      summary: [
        `宗门贡献 +${numeric.contribution}`,
        `修为 +${numeric.cultivationExp}`,
        `灵石 +${numeric.spiritStones}`,
        `${candidate.name}（${candidate.quality}）×${quantity}`,
      ],
      grants: [
        {
          quantity,
          grant: {
            kind: 'sect.reward.material',
            name: candidate.name,
            quality: candidate.quality,
            description: candidate.description,
            type: candidate.type,
            ...(candidate.element ? { element: candidate.element } : {}),
            libraryItemId: candidate.libraryItemId,
          },
        },
      ],
    });
    const payload: SectTaskRecordPayload = {
      ...context.record.payload,
      completionData: {
        mining: {
          score: simulation.score,
          maxScore: simulation.maxScore,
          tier: simulation.tier,
          reward,
        },
      },
    };
    return {
      completed: true,
      completionSettlement: 'deferred',
      payload,
      outcome: {
        renderer: 'sect.outcome.mining-result',
        data: {
          ...outcomeBase,
          tier: simulation.tier,
          rewardSummary: reward.summary,
        },
      },
    };
  }
}

export class BattleTaskExecutor extends BaseTaskExecutor<
  Record<string, unknown>
> {
  readonly key = 'sect.battle';
  inputSchema(): ZodType<Record<string, unknown>> {
    return emptyInput;
  }
  actions(definition: SectTaskDefinition): readonly SectTaskActionDescriptor[] {
    return [
      {
        key: 'execute',
        renderer: 'sect.action.battle',
        label: definition.presentation.actionLabel,
        parameters: resolveSectTaskExecutionLocationParameters(definition),
      },
    ];
  }
  async initializePayload(
    context: SectTaskEnrollmentContext,
  ): Promise<SectTaskRecordPayload> {
    const player = await context.ports.cultivators.loadRuntime(
      context.cultivatorId,
    );
    if (!player) invalid('角色不存在');
    const factory = context.ports.modules
      .require(context.membership.sectId)
      .battles.get(context.definition.id);
    if (!factory) invalid('该宗门任务未配置战斗场景');
    let target: CultivatorCombatInput | null = null;
    let source:
      | { cultivatorId: string; sectId: string; sectName: string }
      | undefined;
    if (factory.acquisition !== 'preset') {
      source =
        (await context.ports.cultivators.findBattleTargetCandidate({
          requesterSectId: context.membership.sectId,
          excludeCultivatorId: context.cultivatorId,
          realms: resolveSectBattleTargetRealmCandidates(
            player.realm,
            factory.acquisition,
          ),
          relation: factory.acquisition,
        })) ?? undefined;
      if (!source)
        invalid(
          factory.acquisition === 'same-sect'
            ? '本周演武名册尚未排到与你同境或低一境的同门，不妨过些时候再来问问。'
            : '近日悬赏册上没有与你同境或低一境的外宗目标，这份令暂时不能揭。',
          409,
        );
      target = await context.ports.cultivators.loadRuntime(source.cultivatorId);
      if (!target)
        invalid(
          factory.acquisition === 'same-sect'
            ? '本周演武名册尚未排到与你同境或低一境的同门，不妨过些时候再来问问。'
            : '近日悬赏册上没有与你同境或低一境的外宗目标，这份令暂时不能揭。',
          409,
        );
    }
    const scenario = factory.create({
      player,
      target,
      sectId: context.membership.sectId,
      opponentId: `sect-target-${context.requestId}`,
    });
    const battleTarget =
      factory.acquisition === 'preset'
        ? SectBattleTargetSnapshotSchema.parse({
            schemaVersion: SECT_BATTLE_TARGET_SCHEMA_VERSION,
            kind: 'preset',
            presetId:
              scenario.presetId ?? `sect-task-${context.definition.id}-v1`,
            rulesVersion: 1,
            challengeTitle: scenario.title,
            name: scenario.opponent.name,
            description: scenario.description,
            realm: scenario.opponent.realm,
            realmStage: scenario.opponent.realm_stage,
            combatant: scenario.opponent,
          })
        : SectBattleTargetSnapshotSchema.parse({
            schemaVersion: SECT_BATTLE_TARGET_SCHEMA_VERSION,
            kind: 'cultivator',
            sourceCultivatorId: source!.cultivatorId,
            sourceSectId: source!.sectId,
            sourceSectName: source!.sectName,
            lockedAt: context.ports.clock.now().toISOString(),
            challengeTitle: scenario.title,
            name: scenario.opponent.name,
            description: scenario.description,
            realm: scenario.opponent.realm,
            realmStage: scenario.opponent.realm_stage,
            combatant: scenario.opponent,
          });
    return SectTaskRecordPayloadSchema.parse({
      ...context.payload,
      executorData: {
        ...context.payload.executorData,
        battleTarget,
      },
    });
  }
  async execute(
    actionKey: string,
    context: SectTaskExecutionContext,
  ): Promise<SectTaskExecutionDecision> {
    if (actionKey !== 'execute') invalid('战斗任务不支持该操作');
    const player = await context.ports.cultivators.loadRuntime(
      context.cultivatorId,
    );
    if (!player) invalid('角色不存在');
    const target = SectBattleTargetSnapshotSchema.safeParse(
      context.record.payload.executorData.battleTarget,
    );
    if (!target.success) invalid('宗门战斗目标快照缺失', 500);
    const opponent = structuredClone(target.data.combatant);
    opponent.id = `sect-task-${context.record.id}-${context.requestId}`;
    const factory = context.ports.modules
      .require(context.membership.sectId)
      .battles.get(context.definition.id);
    if (!factory) invalid('该宗门任务未配置战斗场景', 500);
    const resolution = context.ports.battle.execute(
      player,
      opponent,
      factory.stateStrategy,
      `${context.record.id}:${context.requestId}`,
    );
    const battle = resolution.battleResult;
    const effects = emptySectCommandEffects();
    if (resolution.nextCondition) {
      await context.ports.cultivators.saveCondition(
        context.cultivatorId,
        resolution.nextCondition,
      );
      effects.resourceChanges.push({
        resourceTopic: 'player.condition',
        eventType: 'condition.sect_battle.settled',
        operation: 'replace',
        payload: RESOURCE_DATA_SCHEMAS['player.condition'].parse(
          resolution.nextCondition,
        ),
      });
    }
    const won = battle.outcome.winner.id === player.id;
    return {
      completed: won,
      completionSettlement: 'deferred',
      effects,
      outcome: {
        renderer: 'sect.outcome.battle',
        data: {
          battle,
          won,
          challengeTitle: target.data.challengeTitle,
          taskFulfilled: won,
        },
      },
    };
  }
}

abstract class DeliveryTaskExecutor extends BaseTaskExecutor<SectTaskSubmissionInput> {
  protected abstract readonly itemKind: 'pill' | 'artifact' | 'material';
  inputSchema(): ZodType<SectTaskSubmissionInput> {
    return SectTaskSubmissionInputSchema;
  }
  actions(definition: SectTaskDefinition): readonly SectTaskActionDescriptor[] {
    return [
      {
        key: 'execute',
        renderer: 'sect.action.item-delivery',
        label: definition.presentation.actionLabel,
        parameters: { itemKind: this.itemKind },
      },
    ];
  }
  protected requirement(record: SectTaskRecord) {
    const requirement = record.payload.offer.requirement;
    if (!requirement || requirement.kind !== this.itemKind)
      invalid('任务交付要求缺失');
    return requirement;
  }
  protected completedPayload(
    context: SectTaskExecutionContext,
    selections: readonly {
      item: SectSubmissionItemFacts;
      quantity: number;
    }[],
  ): SectTaskRecordPayload {
    if (selections.length === 0) invalid('交付物品不存在');
    const matchedFact = describeSectDeliveryRequirement(
      this.requirement(context.record),
    );
    return SectTaskRecordPayloadSchema.parse({
      ...context.record.payload,
      completionData: {
        submittedItems: selections.map(({ item, quantity }) => ({
          itemId: item.id,
          kind: item.kind,
          name: item.name,
          quality: item.quality,
          quantity,
          matchedFacts: [matchedFact],
        })),
      },
    });
  }
}

export class PillDeliveryTaskExecutor extends DeliveryTaskExecutor {
  readonly key = 'sect.delivery.pill';
  protected readonly itemKind = 'pill' as const;
  async execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: SectTaskSubmissionInput,
  ): Promise<SectTaskExecutionDecision> {
    if (actionKey !== 'execute') invalid('丹药交付不支持该操作');
    const requirement = this.requirement(context.record);
    const selection = input.items[0];
    if (
      input.items.length !== 1 ||
      !selection ||
      selection.quantity !== requirement.quantity
    )
      invalid(`该委托须一次提交 ${requirement.quantity} 份`);
    const item = await context.ports.submissionInventory.findSubmissionItem(
      context.cultivatorId,
      'pill',
      selection.itemId,
    );
    if (!item) invalid('未找到所选丹药');
    const match = matchSectDeliveryRequirement(requirement, item);
    if (!match.eligible)
      invalid(match.violations[0]?.message ?? '丹药不符合要求');
    const settlement =
      await context.ports.submissionInventory.consumeSubmissionItem({
        cultivatorId: context.cultivatorId,
        kind: 'pill',
        itemId: item.id,
        quantity: selection.quantity,
      });
    if (!settlement.consumed) invalid('丹药数量不足');
    const effects = inventorySettlementEffects(settlement);
    return {
      completed: true,
      completionSettlement: 'claim-reward',
      payload: this.completedPayload(context, [
        { item, quantity: selection.quantity },
      ]),
      outcome: { renderer: 'sect.outcome.fulfilled', data: { success: true } },
      effects,
    };
  }
}

export class ArtifactDeliveryTaskExecutor extends DeliveryTaskExecutor {
  readonly key = 'sect.delivery.artifact';
  protected readonly itemKind = 'artifact' as const;
  async execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: SectTaskSubmissionInput,
  ): Promise<SectTaskExecutionDecision> {
    if (actionKey !== 'execute') invalid('法宝交付不支持该操作');
    const requirement = this.requirement(context.record);
    const selection = input.items[0];
    if (
      input.items.length !== 1 ||
      !selection ||
      selection.quantity !== requirement.quantity
    )
      invalid(`该委托须一次提交 ${requirement.quantity} 件`);
    const item = await context.ports.submissionInventory.findSubmissionItem(
      context.cultivatorId,
      'artifact',
      selection.itemId,
    );
    if (!item) invalid('未找到该法宝');
    const match = matchSectDeliveryRequirement(requirement, item);
    if (!match.eligible)
      invalid(match.violations[0]?.message ?? '法宝不符合要求');
    const settlement =
      await context.ports.submissionInventory.consumeSubmissionItem({
        cultivatorId: context.cultivatorId,
        kind: 'artifact',
        itemId: item.id,
        quantity: selection.quantity,
      });
    if (!settlement.consumed) invalid('法宝状态已变化，请重试');
    const effects = inventorySettlementEffects(settlement);
    return {
      completed: true,
      completionSettlement: 'claim-reward',
      payload: this.completedPayload(context, [
        { item, quantity: selection.quantity },
      ]),
      outcome: { renderer: 'sect.outcome.fulfilled', data: { success: true } },
      effects,
    };
  }
}

export class MaterialDeliveryTaskExecutor extends DeliveryTaskExecutor {
  readonly key = 'sect.delivery.material';
  protected readonly itemKind = 'material' as const;
  async execute(
    actionKey: string,
    context: SectTaskExecutionContext,
    input: SectTaskSubmissionInput,
  ): Promise<SectTaskExecutionDecision> {
    if (actionKey !== 'execute') invalid('材料交付不支持该操作');
    const requirement = this.requirement(context.record);
    if (requirement.kind !== 'material') invalid('任务材料要求缺失');
    const selections = [];
    for (const selection of input.items) {
      const item =
        await context.ports.submissionInventory.findSubmissionItem(
          context.cultivatorId,
          'material',
          selection.itemId,
        );
      if (!item || item.kind !== 'material')
        invalid('悬赏所需材料状态已经变化');
      selections.push({ item, quantity: selection.quantity });
    }
    const match = matchSectMaterialDeliverySelection(requirement, selections);
    if (!match.eligible)
      invalid(match.violations[0]?.message ?? '材料不符合要求');
    let effects = emptySectCommandEffects();
    for (const selection of selections) {
      const settlement =
        await context.ports.submissionInventory.consumeSubmissionItem({
          cultivatorId: context.cultivatorId,
          kind: 'material',
          itemId: selection.item.id,
          quantity: selection.quantity,
        });
      if (!settlement.consumed) invalid('材料状态已变化，请重试');
      effects = mergeSectCommandEffects(
        effects,
        inventorySettlementEffects(settlement),
      );
    }
    return {
      completed: true,
      completionSettlement: 'claim-reward',
      payload: this.completedPayload(context, selections),
      outcome: { renderer: 'sect.outcome.fulfilled', data: { success: true } },
      effects,
    };
  }
}

function inventorySettlementEffects(
  settlement: Awaited<
    ReturnType<
      SectCommandContext['submissionInventory']['consumeSubmissionItem']
    >
  >,
): SectCommandEffects {
  const effects = emptySectCommandEffects();
  if (settlement.change) effects.resourceChanges.push(settlement.change);
  if (settlement.settlement)
    effects.settlement.inventory.push(settlement.settlement);
  return effects;
}

export class ProgressTaskExecutor extends BaseTaskExecutor<
  Record<string, unknown>
> {
  readonly key = 'sect.progress';
  inputSchema(): ZodType<Record<string, unknown>> {
    return z.never();
  }
  actions(): readonly SectTaskActionDescriptor[] {
    return [];
  }
  async execute(): Promise<SectTaskExecutionDecision> {
    return invalid('进度任务不能主动执行');
  }
}

export class DungeonExplorationTaskExecutor extends BaseTaskExecutor<
  Record<string, unknown>
> {
  readonly key = 'sect.dungeon';

  inputSchema(): ZodType<Record<string, unknown>> {
    return z.never();
  }

  actions(definition: SectTaskDefinition): readonly SectTaskActionDescriptor[] {
    return [
      {
        key: 'enter',
        renderer: 'sect.action.dungeon-entry',
        label: definition.presentation.actionLabel,
      },
    ];
  }

  async execute(): Promise<SectTaskExecutionDecision> {
    return invalid('秘境探索任务由秘境结算自动验收');
  }
}

export class SectTaskExecutorRegistry {
  private readonly executors = new Map<string, SectTaskExecutor>();

  constructor(executors: readonly SectTaskExecutor[]) {
    for (const executor of executors) {
      if (this.executors.has(executor.key))
        throw new Error(`宗门任务执行器重复注册：${executor.key}`);
      this.executors.set(executor.key, executor);
    }
  }

  has(key: string): boolean {
    return this.executors.has(key);
  }

  require(key: string): SectTaskExecutor {
    const executor = this.executors.get(key);
    if (!executor)
      throw new SectError(
        'SECT_ORGANIZATION_INVALID',
        `未注册宗门任务执行器：${key}`,
        400,
      );
    return executor;
  }
}
