import { isNotNull } from 'drizzle-orm';
import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  sectCombatStates,
  combatReplayArchives,
  cultivators,
  sectMemberships,
  sectTaskRecords,
} from '@server/lib/drizzle/schema';
import { dungeonPlayer } from '@server/lib/dungeon/combatV6';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { settleBeastDeaths } from '@server/lib/repositories/combatV6BeastRepository';
import { archiveCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Units,
  visibleUnitNames,
} from '@shared/combat-v6/presentation';
import { createCombatV6Replay } from '@shared/combat-v6/replay';
import { liveReplayDelta } from '@shared/combat-v6/replay-timeline';
import type { CombatV6CommandGroup } from '@shared/contracts/combatV6';
import {
  SectV6TargetSchema,
  type SectTaskBattleRuntime,
  type SectTaskSessionView,
} from '@shared/contracts/combatV6SectTask';
import { beastDeathIds } from '@shared/engine/combat-v6/beasts';
import { combatCharacterLevel } from '@shared/engine/combat-v6/projection/character-level';
import {
  createSectBattleHost,
  freezeSectBattleOpponent,
  freezeSectNpcOpponent,
  SectBattleHost,
} from '@shared/engine/combat-v6/sect/host';
import {
  resolveSectBattleTargetRealmCandidates,
  SectTaskRecordPayloadSchema,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import type { CultivatorCondition } from '@shared/types/condition';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { ConditionService } from '../ConditionService';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { createPostgresSectCommandContext } from '../sect-organization/PostgresSectOrganizationAdapters';
import { fulfillSectV6Task } from '../sect-organization/productionSectOrganization';
import {
  invalidSectTask,
  requireSectMembership,
  sectTaskPeriodKey,
} from '../sect-organization/SectTaskApplicationSupport';
import type {
  SectTaskEnrollmentContext,
  SectTaskExecutionContext,
} from '../sect-organization/task-executors/SectTaskExecutor';
import {
  assembleCombatV6TrainingPlayer,
  CombatV6BuildError,
} from './CombatV6BuildService';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { activeSectTaskBattle } from './CombatV6SectTaskOccupancy';

type Actor = { userId: string; cultivatorId: string };
const key = (id: string) => `combat:v6:sect-task:${id}`;
const saveScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if cjson.decode(raw).revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

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
    .select({ id: cultivators.id, sectId: sectMemberships.sectId, membershipId: sectMemberships.id })
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
  const target = SectV6TargetSchema.safeParse(
    context.record.payload.executorData.battleTarget,
  );
  if (!target.success) invalidSectTask('旧版任务不可继续挑战，请等待维护处理');
  if (
    context.record.periodKey !==
    sectTaskPeriodKey(context.definition, context.ports)
  )
    invalidSectTask('任务已过期，不能开启新的挑战');
  if (await activeSectTaskBattle(context.cultivatorId, tx))
    invalidSectTask('请先结束当前宗门战斗及结算');
  const active = await new CombatV6RuntimeStore().currentId(
    context.cultivatorId,
  );
  if (active) invalidSectTask('请先结束当前战斗');
  const { player } = await dungeonPlayer(context.cultivatorId, tx);
  const host = createSectBattleHost(
    player,
    target.data.opponent,
    target.data.resourcePolicy,
    target.data.seed,
  );
  if (target.data.resourcePolicy === 'persistent') {
    await tx.update(cultivators).set({ condition: player.cultivator.condition })
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

async function ownedRuntime(owner: string, id: string) {
  const raw = await redis.get(key(id));
  if (!raw) invalidSectTask('战局数据缺失，请联系维护处理');
  const runtime = JSON.parse(raw) as SectTaskBattleRuntime;
  if (
    runtime.version !== 'sect-task-session-v1' ||
    runtime.cultivatorId !== owner
  )
    invalidSectTask('无权操作此战局');
  const [row] = await db
    .select({ payload: sectTaskRecords.payload })
    .from(sectTaskRecords)
    .innerJoin(
      sectMemberships,
      eq(sectMemberships.id, sectTaskRecords.membershipId),
    )
    .where(
      and(
        eq(sectTaskRecords.id, runtime.recordId),
        eq(sectMemberships.cultivatorId, owner),
      ),
    );
  const payload = row && SectTaskRecordPayloadSchema.parse(row.payload);
  if (payload?.executorData.activeBattleId !== id)
    invalidSectTask('战斗已结束或已开启新的挑战');
  return { runtime, settled: payload.executorData.battleSettled === true };
}
function view(
  runtime: SectTaskBattleRuntime,
  settled: boolean,
  after = -1,
): SectTaskSessionView {
  const host = new SectBattleHost(runtime.snapshot, runtime.snapshot);
  const snapshot = runtime.snapshot;
  return {
    apiVersion: 1,
    sessionId: runtime.battleId,
    taskId: runtime.taskId,
    revision: runtime.revision,
    expiresAt: '9999-12-31T23:59:59.000Z',
    settlement: settled ? 'settled' : host.finished ? 'pending' : undefined,
    combatVersions: host.state.versions,
    round: host.state.round,
    phase: host.state.phase,
    outcome: host.trace().outcome,
    units: combatV6Units(host.state, snapshot.input.statusDefs ?? []),
    display: {
      ...combatV6Display(
        snapshot.input.skills ?? [],
        snapshot.input.statusDefs ?? [],
      ),
      unitNames: visibleUnitNames(host.state, snapshot.events, host.playerId),
    },
    commandOptions: host.finished ? undefined : host.queryCommands(),
    controlledCommandOptions: host.finished
      ? undefined
      : host.controlledCommandOptions(),
    pendingCommand: host.state.units.find((u) => u.id === host.playerId)
      ?.command as SectTaskSessionView['pendingCommand'],
    events: snapshot.events.flatMap((event, seq) =>
      seq > after ? [{ seq, event: combatV6DisplayEvent(event) }] : [],
    ),
    latestEventSeq: snapshot.events.length - 1,
    playback: liveReplayDelta(snapshot.timeline, after),
  };
}
export async function getSectTaskBattle(
  owner: string,
  id?: string,
  after = -1,
) {
  if (!id) {
    const active = await activeSectTaskBattle(owner);
    if (!active) return null;
    id = SectTaskRecordPayloadSchema.parse(active.payload).executorData
      .activeBattleId as string;
  }
  const found = await ownedRuntime(owner, id);
  return view(found.runtime, found.settled, after);
}

export async function changeSectTaskBattle(
  actor: Actor,
  id: string,
  revision: number,
  command?: { unitId: string; commands: CombatV6CommandGroup },
  autoRound?: number,
) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'sect-v6-battle',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) => {
      const found = await ownedRuntime(actor.cultivatorId, id);
      const runtime = found.runtime;
      if (found.settled) return view(runtime, true);
      if (revision !== runtime.revision)
        invalidSectTask('战斗状态已变化，请刷新');
      const host = new SectBattleHost(runtime.snapshot, runtime.snapshot);
      const after = runtime.snapshot.events.length - 1;
      if (!host.finished) {
        if (autoRound !== undefined) {
          if (host.state.round !== autoRound)
            invalidSectTask('战斗回合已变化，请刷新');
          const commands = automaticCommands(
            host.state,
            host.playerId,
            runtime.snapshot.input.skills ?? [],
            (unitId) =>
              host
                .controlledCommandOptions()
                .find((option) => option.unitId === unitId)!,
            { statusDefs: runtime.snapshot.input.statusDefs },
          );
          if (commands.length) host.submitGroup(commands);
        }
        if (command) {
          if (command.unitId !== host.playerId)
            invalidSectTask('无权提交此人物指令');
          host.submitGroup(command.commands);
        } else host.resolveRound();
        runtime.snapshot = host.runtimeSnapshot();
        runtime.revision++;
        lease.assertHeld();
        // Preserve terminal facts before attempting the durable resource transaction.
        if (
          (await redis.eval(
            saveScript,
            1,
            key(id),
            revision,
            JSON.stringify(runtime),
          )) !== 1
        )
          invalidSectTask('战斗状态已变化，请刷新');
      }
      if (host.finished) {
        await db.transaction(async (tx) => {
          await lockCultivatorForStateMutation(tx, actor.cultivatorId);
          const [receipt] = await tx
            .select({ id: combatReplayArchives.battleId })
            .from(combatReplayArchives)
            .where(eq(combatReplayArchives.battleId, id));
          if (receipt) return;
          const [row] = await tx
            .select()
            .from(sectTaskRecords)
            .where(eq(sectTaskRecords.id, runtime.recordId));
          if (!row) invalidSectTask('任务结算事实缺失');
          const payload = SectTaskRecordPayloadSchema.parse(row.payload);
          if (payload.executorData.activeBattleId !== id)
            invalidSectTask('任务战局不匹配');
          const context = createPostgresSectCommandContext({
            tx,
            runtime: productionSectRuntime,
            userId: actor.userId,
          });
          const membership = await requireSectMembership(
            actor.cultivatorId,
            context,
          );
          if (membership.id !== row.membershipId)
            invalidSectTask('宗门成员关系已变化');
          const definition = context.modules
            .require(membership.sectId)
            .tasks.get(row.taskId);
          if (!definition) invalidSectTask('任务定义缺失');
          let changes: import('@shared/contracts/resources').ResourceChangeDescriptor[] =
            [];
          if (host.trace().outcome === 'victory') {
            const fulfilled = await fulfillSectV6Task({
              ...actor,
              membership,
              definition,
              context,
              record: {
                ...row,
                kind: row.kind as 'daily' | 'weekly' | 'promotion',
                status: row.status as 'active' | 'completed' | 'abandoned',
                payload,
                completedAt: row.completedAt ?? undefined,
                claimedAt: row.claimedAt ?? undefined,
              },
            });
            changes = fulfilled.effects.resourceChanges;
          }
          if (runtime.snapshot.resourcePolicy === 'persistent') {
            const [player] = await tx
              .select({ condition: cultivators.condition })
              .from(cultivators)
              .where(eq(cultivators.id, actor.cultivatorId));
            if (!player?.condition) invalidSectTask('角色资源缺失');
            const final = host.state.units.find(
              (unit) => unit.id === host.playerId,
            )!;
            await tx
              .update(cultivators)
              .set({
                condition: ConditionService.applyCombatV6Resources(
                  player.condition as CultivatorCondition,
                  {
                    hp: Math.max(1, final.attrs.hp),
                    mp: final.attrs.mp,
                    maxHp: final.attrs.maxHp,
                    maxMp: final.attrs.maxMp,
                  },
                ),
              })
              .where(eq(cultivators.id, actor.cultivatorId));
            await settleBeastDeaths(
              actor.cultivatorId,
              beastDeathIds(runtime.snapshot.events),
              tx,
            );
          }
          await archiveCombatV6Replay(
            createCombatV6Replay({
              battleId: id,
              participants: [
                {
                  userId: actor.userId,
                  cultivatorId: actor.cultivatorId,
                  unitId: host.playerId,
                  side: 0,
                  slot: 0,
                },
              ],
              metadata: {
                schemaVersion: 1,
                sourceType: 'sect-task',
                battleType: 'pve',
                idempotencyKey: id,
                payload: { recordId: runtime.recordId, taskId: runtime.taskId },
              },
              startedAt: runtime.startedAt,
              finishedAt: new Date().toISOString(),
              reason:
                host.trace().outcome === 'aborted' ? 'fled' : 'battle-ended',
              trace: { ...host.trace(), seed: runtime.snapshot.input.seed! },
            }),
            tx,
          );
          payload.executorData.battleSettled = true;
          await tx
            .update(sectTaskRecords)
            .set({ payload })
            .where(eq(sectTaskRecords.id, row.id));
          await new ResourceEventCommitter().commit(tx, {
            actor,
            source: 'sect-v6-terminal',
            scopeDefaults: { cultivatorId: actor.cultivatorId },
            changes: [
              ...changes,
              {
                resourceTopic: 'player.condition',
                operation: 'invalidate',
                eventType: 'sect.battle.settled',
              },
              {
                resourceTopic: 'sect.tasks',
                operation: 'invalidate',
                eventType: 'sect.battle.settled',
              },
            ],
          });
          lease.assertHeld();
        });
        await redis.expire(key(id), 86400);
      }
      return view(runtime, host.finished, after);
    },
  );
}
