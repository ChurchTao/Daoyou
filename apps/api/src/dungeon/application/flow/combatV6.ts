import type { RealmType } from '@daoyou/constants/realms';
import type { DungeonSessionView } from '@daoyou/contracts/combat/dungeon';
import { EXORCISM_ENCOUNTER_PACK } from '@daoyou/game-content/dungeon/exorcism';
import { getMapNode } from '@daoyou/game-content/world/map';
import type { CombatV6CommandGroup } from '@daoyou/game-domain/combat';
import type { DungeonTemplate } from '@daoyou/game-domain/combat/challenges';
import { type DungeonBattleSnapshot } from '@daoyou/game-domain/combat/challenges';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { DungeonEncounterView } from '@daoyou/game-domain/dungeon';
import type { ExorcismBattleSnapshot } from '@daoyou/game-domain/dungeon/exorcism';
import { getRealmStageLevel as combatCharacterLevel } from '@daoyou/game-domain/progression';
import {
  beastDeathIds,
  beastVictoryExperience,
  gainBeastExp,
} from '@daoyou/game-rules/beasts/growth';
import { evaluateFateContext } from '@daoyou/game-rules/character/fates';
import { publicUnitAppearances } from '@daoyou/game-rules/combat/appearance';
import { automaticCommands } from '@daoyou/game-rules/combat/auto';
import {
  carryDungeonBeastResources,
  createDungeonHost,
  DungeonHost,
} from '@daoyou/game-rules/combat/dungeon/host';
import { liveReplayDelta } from '@daoyou/game-rules/combat/playback';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Playback,
  combatV6Units,
  visibleUnitNames,
} from '@daoyou/game-rules/combat/presentation';
import { projectCharacterToCombatV6 } from '@daoyou/game-rules/combat/projection';
import { createCombatV6Replay } from '@daoyou/game-rules/combat/replay';
import {
  applyExorcismBattle,
  createExorcismHost,
  exorcismCurrentStage,
  ExorcismHost,
  planExorcismWinReward,
} from '@daoyou/game-rules/dungeon/exorcism';
import { appendDungeonReward } from '@daoyou/game-rules/rewards/dungeon';
import {
  clampDungeonEnemyRealmStage,
  resolveDungeonMapConfig,
} from '@daoyou/game-rules/world/dungeon';
import { assembleCombatV6WildPlayer } from '@server/combat/application/CombatV6BuildService.js';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { getCultivatorPreHeavenFates } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import { hasActiveDungeon } from '@server/dungeon/application/flow/occupancy.js';
import {
  resolveDungeonReward,
  resolvePlanItems,
} from '@server/dungeon/application/flow/rewards.js';
import type {
  BattleSession,
  DungeonState,
} from '@server/dungeon/application/flow/types.js';
import { db, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db.js';
import { recordGrowthObserved } from '@server/cultivator/application/GrowthDomainEvents.js';
import {
  cultivatorBeasts,
  cultivators,
  dungeonRuns,
} from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  beastFromRow,
  beastIndividualData,
  settleBeastDeaths,
} from '@server/lib/repositories/combatV6BeastRepository.js';
import { archiveCombatV6Replay } from '@server/lib/repositories/combatV6ReplayRepository.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { and, eq, ne } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';

type AnyDungeonSnapshot = DungeonBattleSnapshot | ExorcismBattleSnapshot;

/** 探秘与除祟共用战斗接口，按快照版本取宿主。 */
function hostOf(
  source:
    | Pick<DungeonBattleSnapshot, 'version' | 'playerId' | 'input'>
    | Pick<
        ExorcismBattleSnapshot,
        'version' | 'playerId' | 'input' | 'npcPlans'
      >,
  restored?: AnyDungeonSnapshot,
): DungeonHost | ExorcismHost {
  return source.version === 'exorcism-v6-v1'
    ? new ExorcismHost(source, restored)
    : new DungeonHost(source, restored);
}

export interface DungeonBattlePayload {
  session: BattleSession;
  snapshot: AnyDungeonSnapshot;
  revision: number;
  startedAt: string;
  settled: boolean;
}
export interface DungeonEncounterPayload {
  encounter:
    | Pick<DungeonBattleSnapshot, 'version' | 'playerId' | 'input'>
    | Pick<
        ExorcismBattleSnapshot,
        'version' | 'playerId' | 'input' | 'npcPlans'
      >;
  preview: DungeonEncounterView;
}
export async function dungeonPlayer(owner: string, tx: DbExecutor = db) {
  const assembled = await assembleCombatV6WildPlayer(owner, tx);
  const projection = projectCharacterToCombatV6({
    ...assembled.player,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projection.ok || !assembled.player.cultivator.condition)
    throw new Error('角色战斗数据或资源尚未初始化');
  if (!(await hasActiveDungeon(owner))) {
    assembled.player.cultivator.condition =
      ConditionService.recoverCombatV6Resources(
        assembled.player.cultivator.condition,
        {
          maxHp: projection.unit.attrs.maxHp!,
          maxMp: projection.unit.attrs.maxMp!,
        },
        new Date(),
        evaluateFateContext(await getCultivatorPreHeavenFates(owner, tx)),
      );
  }
  return {
    ...assembled,
    projection,
    caps: {
      maxHp: projection.unit.attrs.maxHp!,
      maxMp: projection.unit.attrs.maxMp!,
    },
  };
}
function dungeonBattleSetup(state: DungeonState) {
  const map = getMapNode(state.mapNodeId);
  if (!map || !('realm_requirement' in map)) throw new Error('秘境地图无效');
  const mapConfig = resolveDungeonMapConfig(map);
  if (state.exorcism)
    return {
      realm: map.realm_requirement as RealmType,
      stage: EXORCISM_ENCOUNTER_PACK.tiers[mapConfig.difficultyTier].enemyStage,
      template: (['normal', 'normal', 'elite', 'boss'] as const)[
        exorcismCurrentStage(state.exorcism) - 1
      ],
      tier: mapConfig.difficultyTier,
    };
  const battle = state.pendingAction?.costs.find(
    (cost) => cost.type === 'battle',
  );
  const stage = clampDungeonEnemyRealmStage(
    battle?.metadata?.realm_stage ?? '中期',
    mapConfig,
  );
  // 解谜：结尾对决按首领强度，调查途中的守卫按精英强度。
  const template: DungeonTemplate = state.mystery?.pendingGuard
    ? 'elite'
    : state.mystery?.verdict ||
        battle?.metadata?.is_boss ||
        state.currentRound >= state.maxRounds
      ? 'boss'
      : state.currentRound >= 3
        ? 'elite'
        : 'normal';
  return {
    realm: map.realm_requirement as RealmType,
    stage,
    template,
    tier: mapConfig.difficultyTier,
  };
}
export async function prepareDungeonEncounter(
  state: DungeonState,
  narration?: { enemyName: string; description: string; portrait?: string },
): Promise<DungeonEncounterPayload> {
  const { player } = await dungeonPlayer(state.cultivatorId);
  const encounter = dungeonBattleSetup(state);
  const host = createDungeonHost(
    player,
    {
      ...encounter,
      enemyIcon: narration?.portrait
        ? `icon:portrait-${narration.portrait}`
        : undefined,
    },
    randomInt(0, 0x7fffffff),
  );
  // Carry resources across encounters within this run without changing the persistent beast schema.
  const snapshot = host.runtimeSnapshot();
  const narratedName =
    narration?.enemyName ??
    state.pendingAction?.costs.find((cost) => cost.type === 'battle')?.metadata
      ?.enemy_name;
  if (narratedName) {
    const enemies = snapshot.input.units.filter((unit) => unit.side === 1);
    // 解谜遭遇战整队都用叙事里的名字，多于一人时按甲乙丙区分，不出现模板的通用名。
    const named = narration ? enemies : enemies.slice(0, 1);
    named.forEach((enemy, i) => {
      enemy.name = (
        named.length > 1
          ? `${narratedName}·${'甲乙丙丁戊'[i] ?? i + 1}`
          : narratedName
      ).slice(0, 40);
    });
  }
  snapshot.input.units = carryDungeonBeastResources(
    snapshot.input.units,
    snapshot.playerId,
    state.beastResources,
  );
  const unit = snapshot.input.units.find(
    (unit) => unit.id === snapshot.playerId,
  )!;
  return {
    encounter: {
      version: snapshot.version,
      playerId: snapshot.playerId,
      input: snapshot.input,
    },
    preview: {
      id: randomUUID(),
      description:
        narration?.description ??
        state.pendingAction?.costs.find((cost) => cost.type === 'battle')
          ?.metadata?.description ??
        '前路被守敌截住，战意已起。',
      enemies: snapshot.input.units
        .filter((unit) => unit.side === 1)
        .map((unit) => unit.name ?? '秘境守敌'),
      hp: { current: unit.attrs?.hp ?? 0, max: unit.attrs?.maxHp ?? 0 },
      mp: { current: unit.attrs?.mp ?? 0, max: unit.attrs?.maxMp ?? 0 },
      beast:
        snapshot.input.units.find(
          (unit) => unit.ownerId === snapshot.playerId && !unit.benched,
        )?.name ?? null,
    },
  };
}

const EXORCISM_STAGE_LINES = [
  '祟气扑面，先遣的祟物已挡住去路。',
  '两侧有动静，你被埋伏了。',
  '祟主的护法现身了，它的手段和祟主如出一辙。',
  '祟主就在前方。',
];

/** 除祟的下一场：种子由本局种子和场次决定，刷新或重开不会换敌人。 */
export async function prepareExorcismEncounter(
  state: DungeonState,
): Promise<DungeonEncounterPayload> {
  const run = state.exorcism;
  if (!run || state.rewardSeed === undefined) throw new Error('除祟状态缺失');
  const { player } = await dungeonPlayer(state.cultivatorId);
  const setup = dungeonBattleSetup(state);
  const stage = exorcismCurrentStage(run);
  const host = createExorcismHost(
    player,
    { realm: setup.realm, tier: setup.tier },
    run,
    (state.rewardSeed + stage * 7919) >>> 0,
  );
  const snapshot = host.runtimeSnapshot();
  const unit = snapshot.input.units.find((u) => u.id === snapshot.playerId)!;
  return {
    encounter: {
      version: snapshot.version,
      playerId: snapshot.playerId,
      input: snapshot.input,
      npcPlans: snapshot.npcPlans,
    },
    preview: {
      id: randomUUID(),
      description: EXORCISM_STAGE_LINES[stage - 1],
      enemies: snapshot.input.units
        .filter((u) => u.side === 1)
        .map((u) => u.name ?? '祟物'),
      hp: { current: unit.attrs?.hp ?? 0, max: unit.attrs?.maxHp ?? 0 },
      mp: { current: unit.attrs?.mp ?? 0, max: unit.attrs?.maxMp ?? 0 },
      beast:
        snapshot.input.units.find(
          (u) => u.ownerId === snapshot.playerId && !u.benched,
        )?.name ?? null,
    },
  };
}

/** 除祟场次结束：只记局内资源，不写现实气血，也不扣灵兽寿元。 */
async function settleExorcismBattle(
  state: DungeonState,
  host: ExorcismHost,
  tx: DbExecutor,
) {
  const run = state.exorcism!;
  const victory = host.trace().outcome === 'victory';
  if (victory) {
    const map = getMapNode(state.mapNodeId);
    if (!map || !('realm_requirement' in map)) throw new Error('秘境地图无效');
    const mapRealm = map.realm_requirement as RealmType;
    const planned = planExorcismWinReward(
      state.rewardSeed!,
      exorcismCurrentStage(run),
      combatCharacterLevel(mapRealm, '初期'),
      {
        mapRealm,
        playerRealm: state.playerInfo.realm.split(' ')[0] as RealmType,
        difficultyTier: resolveDungeonMapConfig(map).difficultyTier,
      },
    );
    state.v6Rewards = appendDungeonReward(state.v6Rewards ?? [], {
      key: planned.key,
      experience: planned.experience,
      spiritStones: planned.spiritStones,
      items: await resolvePlanItems(planned.plan, tx),
      beastExperience: beastVictoryExperience(host.state, host.playerId),
    });
  }
  state.exorcism = applyExorcismBattle(run, {
    victory,
    resources: host.finalResources(),
  });
}

export function beginDungeonBattle(
  state: DungeonState,
  prepared: DungeonEncounterPayload,
): DungeonBattlePayload {
  const restored = hostOf(prepared.encounter);
  const encounter = dungeonBattleSetup(state);
  return {
    session: {
      battleId: randomUUID(),
      cultivatorId: state.cultivatorId,
      dungeonStateKey: state.runId!,
      enemyData: {
        name: prepared.preview.enemies[0],
        realm: state.playerInfo.realm,
        stage: encounter.stage,
        level: String(combatCharacterLevel(encounter.realm, encounter.stage)),
        difficulty: 1,
      },
    },
    snapshot: restored.runtimeSnapshot(),
    revision: 0,
    startedAt: new Date().toISOString(),
    settled: false,
  };
}
async function readRun(owner: string, battleId?: string, tx: DbExecutor = db) {
  const [run] = await tx
    .select()
    .from(dungeonRuns)
    .where(
      and(
        eq(dungeonRuns.cultivatorId, owner),
        ne(dungeonRuns.status, 'FINISHED'),
      ),
    )
    .limit(1);
  if (!run?.activeBattleId || (battleId && run.activeBattleId !== battleId))
    return null;
  const payload = run.battlePayload as DungeonBattlePayload;
  if (
    payload?.snapshot?.version !== 'dungeon-v6-v1' &&
    payload?.snapshot?.version !== 'exorcism-v6-v1'
  )
    throw new Error('旧秘境会话不可续跑，请由维护流程处理');
  return { run, payload, state: run.runState as DungeonState };
}
function view(payload: DungeonBattlePayload, after = -1): DungeonSessionView {
  const host = hostOf(payload.snapshot, payload.snapshot);
  const snapshot = payload.snapshot;
  return {
    apiVersion: 1,
    controlledUnitId: host.playerId,
    playback: liveReplayDelta(payload.snapshot.timeline, after),
    sessionId: payload.session.battleId,
    revision: payload.revision,
    expiresAt: new Date(Date.parse(payload.startedAt) + 86400000).toISOString(),
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
      ?.command as DungeonSessionView['pendingCommand'],
    events: snapshot.events.flatMap((event, seq) =>
      seq > after ? [{ seq, event: combatV6DisplayEvent(event) }] : [],
    ),
    latestEventSeq: snapshot.events.length - 1,
  };
}
export async function getDungeonBattle(owner: string, id?: string, after = -1) {
  const found = await readRun(owner, id);
  return found ? view(found.payload, after) : null;
}
export async function changeDungeonBattle(
  actor: { userId: string; cultivatorId: string },
  id: string,
  revision: number,
  command?: { unitId: string; commands: CombatV6CommandGroup },
  autoRound?: number,
) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
      context: 'dungeon-v6-battle',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        await lockCultivatorForStateMutation(tx, actor.cultivatorId);
        const found = await readRun(actor.cultivatorId, id, tx);
        if (!found) throw new Error('遭遇战不存在');
        const { run, payload, state } = found;
        if (payload.revision !== revision)
          throw new Error('战斗状态已变化，请刷新');
        const host = hostOf(payload.snapshot, payload.snapshot);
        if (host.finished) return view(payload);
        if (autoRound !== undefined) {
          if (host.state.round !== autoRound)
            throw new Error('战斗回合已变化，请刷新');
          const commands = automaticCommands(
            host.state,
            host.playerId,
            payload.snapshot.input.skills ?? [],
            (id) =>
              host.controlledCommandOptions().find((o) => o.unitId === id)!,
            {
              statusDefs: payload.snapshot.input.statusDefs,
              strategies: { [host.playerId]: host.playerAutoStrategy },
            },
          );
          if (commands.length) host.submitGroup(commands);
        }
        const after = payload.snapshot.events.length - 1;
        const playback = combatV6Playback(
          after,
          payload.snapshot.input.statusDefs ?? [],
          host.state,
        );
        if (command) {
          if (command.unitId !== host.playerId)
            throw new Error('无权提交此人物指令');
          host.submitGroup(command.commands);
        } else host.resolveRound(playback.capture);
        payload.snapshot = host.runtimeSnapshot();
        payload.revision++;
        if (!command)
          playback.capture(host.state, payload.snapshot.events.length - 1);
        if (host.finished && !payload.settled) {
          if (state.exorcism) {
            if (!(host instanceof ExorcismHost))
              throw new Error('除祟战斗宿主不匹配');
            await settleExorcismBattle(state, host, tx);
          } else {
            const final = host.state.units.find((u) => u.id === host.playerId)!;
            const [row] = await tx
              .select({ condition: cultivators.condition })
              .from(cultivators)
              .where(eq(cultivators.id, actor.cultivatorId));
            if (!row?.condition) throw new Error('角色资源缺失');
            const condition = ConditionService.applyCombatV6Resources(
              row.condition as CultivatorCondition,
              {
                hp: Math.max(1, final.attrs.hp),
                mp: final.attrs.mp,
                maxHp: final.attrs.maxHp,
                maxMp: final.attrs.maxMp,
              },
            );
            await tx
              .update(cultivators)
              .set({ condition })
              .where(eq(cultivators.id, actor.cultivatorId));
            await settleBeastDeaths(
              actor.cultivatorId,
              beastDeathIds(payload.snapshot.events),
              tx,
            );
            state.beastResources = {
              ...state.beastResources,
              ...Object.fromEntries(
                host.state.units
                  .filter((u) => u.ownerId === host.playerId)
                  .map((u) => [u.id, { hp: u.attrs.hp, mp: u.attrs.mp }]),
              ),
            };
            if (host.trace().outcome === 'victory') {
              const reward = await resolveDungeonReward(
                state,
                `battle:${id}`,
                'battle',
                tx,
              );
              reward.beastExperience = beastVictoryExperience(
                host.state,
                host.playerId,
              );
              state.v6Rewards = appendDungeonReward(
                state.v6Rewards ?? [],
                reward,
              );
            }
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
                sourceType: 'dungeon',
                battleType: 'pve',
                idempotencyKey: id,
                payload: { runId: run.id, nodeId: state.mapNodeId },
              },
              startedAt: payload.startedAt,
              finishedAt: new Date().toISOString(),
              reason:
                host.trace().outcome === 'aborted' ? 'fled' : 'battle-ended',
              trace: { ...host.trace(), seed: payload.snapshot.input.seed! },
            }),
            tx,
          );
          payload.settled = true;
          await new ResourceEventCommitter().commit(tx, {
            actor,
            source: 'dungeon-v6-terminal',
            scopeDefaults: { cultivatorId: actor.cultivatorId },
            changes: [
              {
                resourceTopic: 'player.condition',
                operation: 'invalidate',
                eventType: 'dungeon.battle.settled',
              },
            ],
          });
        }
        lease.assertHeld();
        await tx
          .update(dungeonRuns)
          .set({ battlePayload: payload, runState: state })
          .where(eq(dungeonRuns.id, run.id));
        return {
          ...view(payload, after),
          ...(!command ? { playback: playback.playback } : {}),
        };
      }),
  );
}

export async function grantDungeonBeastExperience(
  state: DungeonState,
  tx: DbTransaction,
) {
  const { player } = await dungeonPlayer(state.cultivatorId, tx);
  const level = combatCharacterLevel(
    player.cultivator.realm,
    player.cultivator.realm_stage,
  );
  let observedLevel = 0;
  for (const reward of state.v6Rewards ?? []) {
    if (!reward.beastExperience) continue;
    const { beastId, amount } = reward.beastExperience;
    const [row] = await tx
      .select()
      .from(cultivatorBeasts)
      .where(
        and(
          eq(cultivatorBeasts.id, beastId),
          eq(cultivatorBeasts.cultivatorId, state.cultivatorId),
        ),
      );
    if (!row) throw new Error('经验接收灵兽不存在');
    const progressed = gainBeastExp(beastFromRow(row), amount, level);
    observedLevel = Math.max(observedLevel, progressed.level);
    await tx
      .update(cultivatorBeasts)
      .set({
        individual: beastIndividualData(progressed),
      })
      .where(eq(cultivatorBeasts.id, beastId));
  }
  if (observedLevel > 0) await recordGrowthObserved(tx, {
    cultivatorId: state.cultivatorId, discipline: 'beasts', value: observedLevel,
  });
}
