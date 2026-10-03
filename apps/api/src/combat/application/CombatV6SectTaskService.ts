import { automaticCommands } from '@daoyou/shared/combat-v6/auto';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Units,
  visibleUnitNames,
} from '@daoyou/shared/combat-v6/presentation';
import { createCombatV6Replay } from '@daoyou/shared/combat-v6/replay';
import { liveReplayDelta } from '@daoyou/shared/combat-v6/replay-timeline';
import { publicUnitAppearances } from '@daoyou/shared/combat-v6/unit-appearance';
import type { CombatV6CommandGroup } from '@daoyou/shared/contracts/combatV6';
import {
  type SectTaskBattleRuntime,
  type SectTaskSessionView,
} from '@daoyou/shared/contracts/combatV6SectTask';
import { beastDeathIds } from '@daoyou/shared/engine/combat-v6/beasts';
import { SectBattleHost } from '@daoyou/shared/engine/combat-v6/sect/host';
import { SectTaskRecordPayloadSchema } from '@daoyou/shared/engine/sect';
import { productionSectRuntime } from '@daoyou/shared/engine/sect/content';
import type { CultivatorCondition } from '@daoyou/shared/types/condition';
import { db } from '@server/lib/drizzle/db.js';
import {
  combatReplayArchives,
  cultivators,
  sectMemberships,
  sectTaskRecords,
} from '@server/lib/drizzle/schema.js';
import { redis } from '@server/lib/redis/index.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { settleBeastDeaths } from '@server/lib/repositories/combatV6BeastRepository.js';
import { archiveCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { and, eq } from 'drizzle-orm';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { describeJournal, runJournalSettlement } from '@server/player/application/JournalSettlement.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { createPostgresSectCommandContext } from '@server/sects/organization/PostgresSectOrganizationAdapters.js';
import { fulfillSectV6Task } from '@server/sects/organization/productionSectOrganization.js';
import {
  invalidSectTask,
  requireSectMembership,
} from '@server/sects/organization/SectTaskApplicationSupport.js';
import { activeSectTaskBattle } from '@server/combat/application/CombatV6SectTaskOccupancy.js';

type Actor = { userId: string; cultivatorId: string };
const key = (id: string) => `combat:v6:sect-task:${id}`;
const saveScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
if cjson.decode(raw).revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

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
    controlledUnitId: host.playerId,
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
      unitAppearances: publicUnitAppearances(
        snapshot.timeline.unitAppearances,
        visibleUnitNames(host.state, snapshot.events, host.playerId),
      ),
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
            {
              statusDefs: runtime.snapshot.input.statusDefs,
              strategies: { [host.playerId]: host.playerAutoStrategy },
            },
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
          await runJournalSettlement(
            tx,
            actor.cultivatorId,
            'sect_battle_settlement',
            id,
            async () => {
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
              describeJournal(
                tx,
                actor.cultivatorId,
                definition.presentation.title,
              );
              let changes: import('@daoyou/shared/contracts/resources').ResourceChangeDescriptor[] =
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
                    payload: {
                      recordId: runtime.recordId,
                      taskId: runtime.taskId,
                    },
                  },
                  startedAt: runtime.startedAt,
                  finishedAt: new Date().toISOString(),
                  reason:
                    host.trace().outcome === 'aborted'
                      ? 'fled'
                      : 'battle-ended',
                  trace: {
                    ...host.trace(),
                    seed: runtime.snapshot.input.seed!,
                  },
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
            },
          );
        });
        await redis.expire(key(id), 86400);
      }
      return view(runtime, host.finished, after);
    },
  );
}
