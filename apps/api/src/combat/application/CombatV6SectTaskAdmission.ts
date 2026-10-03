import {
  SectV6TargetSchema,
  type SectTaskBattleRuntime,
} from '@daoyou/shared/contracts/combatV6SectTask';
import { combatCharacterLevel } from '@daoyou/shared/engine/combat-v6/projection/character-level';
import {
  createSectBattleHost,
  freezeSectBattleOpponent,
  freezeSectNpcOpponent,
} from '@daoyou/shared/engine/combat-v6/sect/host';
import { resolveSectBattleTargetRealmCandidates } from '@daoyou/shared/engine/sect';
import { productionSectRuntime } from '@daoyou/shared/engine/sect/content';
import { type DbTransaction } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  sectCombatStates,
  sectMemberships,
} from '@server/lib/drizzle/schema.js';
import { dungeonPlayer } from '@server/dungeon/combat-player.js';
import { redis } from '@server/lib/redis/index.js';
import { and, eq, inArray, isNotNull, ne, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import {
  invalidSectTask,
  sectTaskPeriodKey,
} from '@server/sects/organization/SectTaskApplicationSupport.js';
import type {
  SectTaskEnrollmentContext,
  SectTaskExecutionContext,
} from '@server/sects/organization/task-executors/SectTaskExecutor.js';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import {
  assembleCombatV6TrainingPlayer,
  CombatV6BuildError,
} from '@server/combat/application/CombatV6BuildService.js';

const key = (id: string) => `combat:v6:sect-task:${id}`;

export async function freezeSectTaskTarget(
  context: SectTaskEnrollmentContext,
  tx: DbTransaction,
) {
  const taskId = context.definition.id;
  const progress = await context.ports.cultivators.loadProgress(
    context.cultivatorId,
  );
  if (!progress) invalidSectTask('角色不存在');
  const base = {
    schemaVersion: 2 as const,
    realm: progress.realm,
    realmStage: progress.stage,
    lockedAt: context.ports.clock.now().toISOString(),
    seed: randomInt(0, 0x7fffffff),
    contentVersion: 'combat-v6-sect-task-v1' as const,
    resourcePolicy:
      taskId === 'weekly_tournament'
        ? ('full' as const)
        : ('persistent' as const),
  };
  if (taskId === 'mine_patrol' || taskId === 'elder_trial') {
    const opponent = freezeSectNpcOpponent(
      taskId,
      combatCharacterLevel(progress.realm, progress.stage),
    );
    return SectV6TargetSchema.parse({
      ...base,
      kind: 'preset',
      opponent,
      name: opponent.units[0]!.name,
      challengeTitle: taskId === 'mine_patrol' ? '矿场巡视' : '长老试炼',
      description:
        taskId === 'mine_patrol' ? '盘踞矿脉的妖兽。' : '长老凝聚的试炼化身。',
    });
  }
  if (taskId !== 'weekly_tournament' && taskId !== 'weekly_bounty_battle')
    invalidSectTask('未知宗门战斗任务');
  const sameSect = taskId === 'weekly_tournament';
  const candidates = await tx
    .select({
      id: cultivators.id,
      sectId: sectMemberships.sectId,
      membershipId: sectMemberships.id,
    })
    .from(sectMemberships)
    .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
    .innerJoin(
      sectCombatStates,
      eq(sectCombatStates.membershipId, sectMemberships.id),
    )
    .where(
      and(
        eq(sectMemberships.status, 'active'),
        eq(cultivators.status, 'active'),
        isNotNull(sectCombatStates.activePathId),
        ne(cultivators.id, context.cultivatorId),
        inArray(
          cultivators.realm,
          resolveSectBattleTargetRealmCandidates(
            progress.realm,
            sameSect ? 'same-sect' : 'other-sect',
          ),
        ),
        sameSect
          ? eq(sectMemberships.sectId, context.membership.sectId)
          : ne(sectMemberships.sectId, context.membership.sectId),
      ),
    )
    .orderBy(sql`random()`);
  for (const candidate of candidates) {
    let assembled;
    try {
      assembled = await assembleCombatV6TrainingPlayer(candidate.id, tx);
    } catch (error) {
      if (error instanceof CombatV6BuildError) continue;
      throw error;
    }
    if (assembled.membershipId !== candidate.membershipId) continue;
    const opponent = freezeSectBattleOpponent(assembled.player);
    return SectV6TargetSchema.parse({
      ...base,
      kind: 'cultivator',
      opponent,
      realm: assembled.player.cultivator.realm,
      realmStage: assembled.player.cultivator.realm_stage,
      name: assembled.player.cultivator.name,
      challengeTitle: sameSect ? '宗门小比' : '悬赏令·讨伐',
      description: sameSect
        ? '演武名册中锁定的同门副本。'
        : '悬赏令中锁定的外宗副本。',
      sourceCultivatorId: candidate.id,
      sourceSectId: candidate.sectId,
      sourceSectName: productionSectRuntime.registry.require(candidate.sectId)
        .definition.name,
    });
  }
  invalidSectTask(
    sameSect
      ? '暂无同境或低一境的有效新版同门构筑，未占用领取额度'
      : '暂无同境或低一境的有效新版外宗构筑，未占用领取额度',
  );
}

export async function startSectTaskBattle(
  context: SectTaskExecutionContext,
  tx: DbTransaction,
) {
  if (await hasActiveCombat(context.cultivatorId))
    invalidSectTask('请先结束当前战斗与结算');
  const target = SectV6TargetSchema.safeParse(
    context.record.payload.executorData.battleTarget,
  );
  if (!target.success) invalidSectTask('旧版任务不可继续挑战，请等待维护处理');
  if (
    context.record.periodKey !==
    sectTaskPeriodKey(context.definition, context.ports)
  )
    invalidSectTask('任务已过期，不能开启新的挑战');
  const { player } = await dungeonPlayer(context.cultivatorId, tx);
  const host = createSectBattleHost(
    player,
    target.data.opponent,
    target.data.resourcePolicy,
    target.data.seed,
  );
  if (target.data.resourcePolicy === 'persistent') {
    await tx
      .update(cultivators)
      .set({ condition: player.cultivator.condition })
      .where(eq(cultivators.id, context.cultivatorId));
  }
  const runtime: SectTaskBattleRuntime = {
    version: 'sect-task-session-v1',
    battleId: randomUUID(),
    userId: context.userId,
    cultivatorId: context.cultivatorId,
    recordId: context.record.id,
    taskId: context.record.taskId,
    startedAt: context.ports.clock.now().toISOString(),
    revision: 0,
    snapshot: host.runtimeSnapshot(),
  };
  // The task pointer is committed by the surrounding task transaction. An orphan cannot occupy a player.
  await redis.set(key(runtime.battleId), JSON.stringify(runtime));
  return { battleId: runtime.battleId };
}
