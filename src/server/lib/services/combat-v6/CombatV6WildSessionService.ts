import { hasActiveSectTaskBattle } from './CombatV6SectTaskOccupancy';
import { db } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { hasActiveDungeon } from '@server/lib/dungeon/occupancy';
import { redis } from '@server/lib/redis';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { hasActiveRanking } from '@server/lib/redis/rankingChallenge';
import { findActiveSectMembership } from '@server/lib/repositories/sectCombatRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { hasActiveTower } from '@server/lib/tower/occupancy';
import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Playback,
  combatV6Units,
  visibleUnitNames,
} from '@shared/combat-v6/presentation';
import { createCombatV6Replay } from '@shared/combat-v6/replay';
import { liveReplayDelta } from '@shared/combat-v6/replay-timeline';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import type {
  CombatV6ReplayV1,
  CombatV6TerminalOutboxV1,
  CombatV6TerminalReason,
} from '@shared/contracts/combatV6Runtime';
import type {
  WildRuntime,
  WildSessionView,
  WildSettlement,
} from '@shared/contracts/combatV6Wild';
import { DOMAIN_EVENT_DEFINITIONS } from '@shared/contracts/domainEvents';
import { beastDeathIds } from '@shared/engine/combat-v6/beasts';
import {
  beastVictoryExperience,
  generateCapturedBeast,
} from '@shared/engine/combat-v6/beasts/progression';
import { SeededRng } from '@shared/engine/combat-v6/core';
import { projectCultivatorMultiSectV5ToCombatV6 } from '@shared/engine/combat-v6/projection';
import {
  WILD_CONTENT_VERSION,
  WILD_REGION,
  WILD_SPECIES,
} from '@shared/engine/combat-v6/wild/content';
import { createWildHost, WildHost } from '@shared/engine/combat-v6/wild/host';
import { wildDay } from '@shared/engine/combat-v6/wild/rules';
import { evaluateFateContext } from '@shared/lib/fates';
import { WILD_DROP_POOLS, wildItemRewards } from '@shared/rewards/wild';
import { eq } from 'drizzle-orm';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { ConditionService } from '../ConditionService';
import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { getCultivatorPreHeavenFates } from '../cultivator/CultivatorProfileRepository';
import { arenaOccupancyKey } from './CombatV6ArenaStore';
import { assembleCombatV6TrainingPlayer } from './CombatV6BuildService';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { CombatV6WildStore } from './CombatV6WildStore';

type Actor = { userId: string; cultivatorId: string };
export class WildError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 409 | 422 = 409,
  ) {
    super(message);
  }
}
const store = new CombatV6WildStore();
const common = new CombatV6RuntimeStore();
export function wildTerminal(
  s: WildSettlement,
  reason: CombatV6TerminalReason,
  outcome: 'victory' | 'defeat' | 'draw' | 'aborted' = 'aborted',
  replayExpected = false,
): CombatV6TerminalOutboxV1 {
  const finishedAt = new Date().toISOString();
  return {
    version: 'combat_v6_terminal_outbox_v1',
    event: {
      id: randomUUID(),
      type: 'combat.v6.battle.finished',
      version: 1,
      subject: DOMAIN_EVENT_DEFINITIONS['combat.v6.battle.finished'].subject,
      occurredAt: finishedAt,
      aggregate: { type: 'combat-v6-battle', id: s.battleId },
      correlationId: s.metadata.idempotencyKey,
      data: { battleId: s.battleId },
    },
    record: {
      deadBeastIds: s.deadBeastIds,
      battleId: s.battleId,
      cultivatorId: s.cultivatorId,
      metadata: s.metadata,
      combatVersions: s.combatVersions,
      startedAt: s.createdAt,
      finishedAt,
      round: s.round,
      outcome,
      reason,
      replayExpected,
    },
  };
}
function summaryOf(
  r: WildRuntime,
  entry: WildSettlement['entry'],
): WildSettlement {
  const p = r.host.state.units.find((u) => u.id === r.host.playerId)!;
  const rewardHash = (key: string) =>
    createHash('sha256')
      .update(
        `${r.battleId}:${r.host.input.seed}:${r.dropPool.id}:${r.dropPool.version}:${key}`,
      )
      .digest();
  return {
    itemRewards:
      r.host.state.result?.winner === p.side
        ? (r.itemRewards ??
          wildItemRewards(
            r.dropPool,
            (key) => {
              const rng = new SeededRng(rewardHash(key).readUInt32LE());
              return () => rng.next();
            },
            (group) => {
              const hex = rewardHash(`instance:${group}`).toString('hex');
              return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
            },
            r.createdAt,
          ))
        : [],
    capturedBeasts: r.host.events.flatMap((event) => {
      if (event.type !== 'unitCaptured' || event.unitId !== r.host.playerId)
        return [];
      const target = r.host.combatants.find((c) => c.unitId === event.targetId);
      if (!target) throw new Error('CAPTURE_TARGET_MISSING');
      // Battle UUID plus encounter slot gives a stable UUID without another receipt table.
      const hex = createHash('sha256')
        .update(`${r.battleId}:${target.unitId}`)
        .digest('hex');
      const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
      return [
        generateCapturedBeast(
          id,
          r.cultivatorId,
          target.speciesId,
          target.level,
          event.generationSeed,
        ),
      ];
    }),
    beastExperience: beastVictoryExperience(r.host.state, r.host.playerId),
    deadBeastIds: beastDeathIds(r.host.events),
    schemaVersion: 1,
    battleId: r.battleId,
    userId: r.userId,
    cultivatorId: r.cultivatorId,
    membershipId: r.membershipId,
    metadata: r.metadata,
    combatVersions: r.host.state.versions,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    revision: r.revision,
    round: r.host.state.round,
    entry,
    final: {
      hp: p.attrs.hp,
      mp: p.attrs.mp,
      maxHp: entry.maxHp,
      maxMp: entry.maxMp,
    },
  };
}
function checked(result: string) {
  if (result !== 'OK')
    throw new WildError(
      `WILD_${result}`,
      result === 'NOT_FOUND' ? '战斗已结束或过期' : '战斗状态已变化，请刷新',
      result === 'NOT_FOUND' ? 404 : 409,
    );
}

export class CombatV6WildSessionService {
  async region(actor: Actor, nodeId: string) {
    if (nodeId !== WILD_REGION.nodeId)
      throw new WildError('UNKNOWN_WILD_REGION', '此处尚未开放灵兽探索', 404);
    const day = wildDay(Date.now());
    const activeId = await common.currentId(actor.cultivatorId);
    const activeTraining = activeId ? await common.get(activeId) : null;
    return {
      ...WILD_REGION,
      species: WILD_SPECIES,
      dailyLimit: 20,
      remaining: Math.max(0, 20 - (await store.used(actor.cultivatorId))),
      resetsAt: new Date(day.resetAt).toISOString(),
      settlingBattleId: await store.lock(actor.cultivatorId),
      trainingSessionId: activeTraining?.battleId ?? null,
    };
  }
  async explore(actor: Actor, nodeId: string, requestId: string) {
    const previous = await store.request(actor.cultivatorId, requestId);
    if (previous) {
      if (previous.nodeId !== nodeId)
        throw new WildError(
          'WILD_IDEMPOTENCY_CONFLICT',
          '同一请求不能探索不同区域',
        );
      return this.get(actor, previous.battleId);
    }
    await this.region(actor, nodeId);
    return withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
        context: 'wild-exploration',
        timeoutMs: 30000,
        retries: 0,
      },
      async (lease) => {
        if (
          (await hasActiveTower(actor.cultivatorId)) ||
          (await hasActiveRanking(actor.cultivatorId)) ||
          (await hasActiveDungeon(actor.cultivatorId)) ||
          ((await hasActiveSectTaskBattle(actor.cultivatorId)) || (await hasActiveBreakthroughBattle(actor.cultivatorId)))
        )
          throw new WildError('DUNGEON_ACTIVE', '请先结束秘境探索与结算');
        if (await redis.get(arenaOccupancyKey(actor.cultivatorId)))
          throw new WildError('WILD_BATTLE_ALREADY_ACTIVE', '请先结束擂台战斗');
        const activeId = await common.currentId(actor.cultivatorId);
        if (activeId) {
          const r = await store.get(activeId);
          if (r?.metadata.payload.nodeId === nodeId)
            return this.get(actor, activeId);
          throw new WildError('WILD_BATTLE_ALREADY_ACTIVE', '请先结束当前战斗');
        }
        if (await store.lock(actor.cultivatorId))
          throw new WildError('WILD_SETTLEMENT_PENDING', '上场战斗正在结算');
        return db.transaction(async (tx) => {
          await lockCultivatorForStateMutation(tx, actor.cultivatorId);
          const assembled = await assembleCombatV6TrainingPlayer(
            actor.cultivatorId,
            tx,
          );
          const projected = projectCultivatorMultiSectV5ToCombatV6({
            ...assembled.player,
            side: 0,
            slot: 0,
            resourcePolicy: 'full',
          });
          if (!projected.ok)
            throw new WildError('WILD_PLAYER_INVALID', '人物构筑无法投影', 422);
          const condition = assembled.player.cultivator.condition;
          if (!condition)
            throw new WildError(
              'WILD_CONDITION_REQUIRED',
              '人物资源尚未初始化',
              422,
            );
          const now = Date.now();
          const attrs = projected.unit.attrs!;
          const fateContext = evaluateFateContext(
            await getCultivatorPreHeavenFates(actor.cultivatorId, tx),
          );
          const recovered = ConditionService.recoverCombatV6Resources(
            condition,
            { maxHp: attrs.maxHp!, maxMp: attrs.maxMp! },
            new Date(now),
            fateContext,
          );
          const player = {
            ...assembled.player,
            cultivator: {
              ...assembled.player.cultivator,
              condition: recovered,
            },
          };
          let host: WildHost;
          try {
            host = createWildHost(nodeId, randomInt(0, 0x7fffffff), player);
          } catch (error) {
            throw new WildError(
              'WILD_PLAYER_INVALID',
              error instanceof Error ? error.message : '人物构筑无法投影',
              422,
            );
          }
          const snapshot = host.runtimeSnapshot();
          const r: WildRuntime = {
            dropPool: structuredClone(WILD_DROP_POOLS[nodeId]),
            runtimeVersion: 'combat_v6_redis_runtime_v1',
            battleId: randomUUID(),
            ...actor,
            membershipId: assembled.membershipId,
            metadata: {
              schemaVersion: 1,
              sourceType: 'wild-encounter',
              battleType: 'pve',
              idempotencyKey: randomUUID(),
              payload: {
                nodeId,
                encounterContentVersion: WILD_CONTENT_VERSION,
                combatants: snapshot.combatants,
              },
            },
            revision: 0,
            createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 7200000).toISOString(),
            latestEventSeq: snapshot.events.length - 1,
            host: snapshot,
          };
          const p = snapshot.state.units.find((u) => u.id === host.playerId)!;
          const s = summaryOf(r, {
            hp: p.attrs.hp,
            mp: p.attrs.mp,
            maxHp: p.attrs.maxHp,
            maxMp: p.attrs.maxMp,
          });
          lease.assertHeld();
          const [status, id] = await store.create(r, s, requestId, now);
          if (status === 'EXISTING') {
            const existing = await store.get(id);
            if (existing?.metadata.payload.nodeId === nodeId)
              return this.view(existing);
            throw new WildError(
              'WILD_REQUEST_COMPLETED',
              '该请求已处理或存在其他战斗',
            );
          }
          if (status !== 'CREATED')
            throw new WildError(
              `WILD_${status}`,
              status === 'LIMIT'
                ? '今日探索次数已用尽'
                : status === 'COOLDOWN'
                  ? '请稍候再探索'
                  : '当前无法探索',
            );
          // Redis is authoritative after creation. If this transaction fails, settlement still has its entry facts.
          await tx
            .update(cultivators)
            .set({ condition: recovered })
            .where(eq(cultivators.id, actor.cultivatorId));
          await new ResourceEventCommitter().commit(tx, {
            actor,
            source: 'combat-v6-wild-entry',
            scopeDefaults: { cultivatorId: actor.cultivatorId },
            changes: [
              {
                resourceTopic: 'player.condition',
                operation: 'invalidate',
                eventType: 'combat_v6.wild.entered',
              },
            ],
          });
          return this.view(r);
        });
      },
    );
  }
  async current(actor: Actor) {
    const id = await common.currentId(actor.cultivatorId);
    if (!id) return null;
    if (await store.summary(id)) return this.get(actor, id);
    if (!(await store.get(id))) return null;
    return this.get(actor, id);
  }
  private async require(actor: Actor, id: string) {
    let r: WildRuntime | null;
    try {
      r = await store.get(id);
    } catch {
      const s = await store.summary(id);
      if (
        !s ||
        s.userId !== actor.userId ||
        s.cultivatorId !== actor.cultivatorId
      )
        throw new WildError('WILD_SESSION_NOT_FOUND', '战斗不存在', 404);
      await store.finish(s, wildTerminal(s, 'technical-abort'));
      throw new WildError('WILD_TECHNICAL_ABORT', '战斗数据无法恢复，正在结算');
    }
    if (!r) {
      const s = await store.summary(id);
      if (s?.userId === actor.userId && s.cultivatorId === actor.cultivatorId)
        await store.finish(
          s,
          wildTerminal(
            s,
            Date.now() >= Date.parse(s.expiresAt)
              ? 'expired'
              : 'technical-abort',
          ),
        );
      throw new WildError('WILD_SESSION_NOT_FOUND', '战斗不存在或已中止', 404);
    }
    if (r.userId !== actor.userId || r.cultivatorId !== actor.cultivatorId)
      throw new WildError('WILD_SESSION_NOT_FOUND', '战斗不存在', 404);
    const s = await store.summary(id);
    if (Date.parse(r.expiresAt) <= Date.now()) {
      if (s) await store.finish(s, wildTerminal(s, 'expired'));
      throw new WildError('WILD_SESSION_NOT_FOUND', '战斗已过期', 404);
    }
    const membership = await findActiveSectMembership(
      actor.cultivatorId,
      db,
    );
    if (membership?.membershipId !== r.membershipId) {
      if (s) await store.finish(s, wildTerminal(s, 'membership-changed'));
      else if (r.host.state.result) await store.clearFinished(r, r.revision);
      throw new WildError(
        'WILD_MEMBERSHIP_CHANGED',
        '宗门已变化，战斗正在结算',
      );
    }
    try {
      new WildHost(r.host, r.host);
    } catch (error) {
      if (s) await store.finish(s, wildTerminal(s, 'technical-abort'));
      throw error;
    }
    return r;
  }
  async get(actor: Actor, id: string, after = -1) {
    return this.view(await this.require(actor, id), after);
  }
  async submit(
    actor: Actor,
    id: string,
    expected: number,
    unitId: string,
    commands: import('@shared/contracts/combatV6').CombatV6CommandGroup,
  ) {
    return this.change(actor, id, expected, (host) => {
      if (unitId !== host.playerId)
        throw new WildError('WILD_COMMAND_INVALID', '无权提交此人物指令', 400);
      host.submitGroup(commands);
    });
  }
  async resolve(
    actor: Actor,
    id: string,
    expected: number,
    autoRound?: number,
  ) {
    return this.change(
      actor,
      id,
      expected,
      (host, capture) => host.resolveRound(capture),
      true,
      autoRound,
    );
  }
  private async change(
    actor: Actor,
    id: string,
    expected: number,
    action: (
      host: WildHost,
      capture: ReturnType<typeof combatV6Playback>['capture'],
    ) => unknown,
    resolving = false,
    autoRound?: number,
  ) {
    const r = await this.require(actor, id);
    if (r.revision !== expected) checked('CONFLICT');
    const host = new WildHost(r.host, r.host);
    if (host.finished) throw new WildError('WILD_FINISHED', '战斗已结束');
    const presentation = combatV6Playback(
      r.latestEventSeq,
      r.host.input.statusDefs ?? [],
      host.state,
    );
    if (autoRound !== undefined) {
      if (host.state.round !== autoRound)
        throw new Error('战斗回合已变化，请刷新');
      const commands = automaticCommands(
        host.state,
        host.playerId,
        r.host.input.skills ?? [],
        (id) => host.controlledCommandOptions().find((o) => o.unitId === id)!,
      );
      if (commands.length) host.submitGroup(commands);
    }
    action(host, presentation.capture);
    const s = await store.summary(id);
    if (!s) throw new WildError('WILD_SETTLEMENT_MISSING', '结算事实缺失');
    const next: WildRuntime = {
      ...r,
      revision: r.revision + 1,
      host: host.runtimeSnapshot(),
    };
    next.latestEventSeq = next.host.events.length - 1;
    const nextSummary = summaryOf(next, s.entry);
    if (host.finished) next.itemRewards = nextSummary.itemRewards ?? [];
    const trace = host.trace();
    const event = host.finished
      ? wildTerminal(
          nextSummary,
          trace.outcome === 'aborted' ? 'fled' : 'battle-ended',
          trace.outcome!,
          true,
        )
      : undefined;
    const replay: CombatV6ReplayV1 | undefined = event
      ? createCombatV6Replay({
          trace: { ...trace, seed: next.host.input.seed! },
          battleId: id,
          participants: [
            {
              userId: actor.userId,
              cultivatorId: actor.cultivatorId,
              unitId: host.playerId,
              side: host.state.units.find((u) => u.id === host.playerId)!.side,
              slot: host.state.units.find((u) => u.id === host.playerId)!.slot,
            },
          ],
          metadata: r.metadata,
          startedAt: r.createdAt,
          finishedAt: event.record.finishedAt,
          reason: event.record.reason,
        })
      : undefined;
    checked(await store.save(next, expected, nextSummary, event, replay));
    if (resolving) presentation.capture(host.state, next.latestEventSeq);
    return {
      ...(await this.view(next, r.latestEventSeq)),
      ...(resolving ? { playback: presentation.playback } : {}),
    };
  }
  async abandon(actor: Actor, id: string, expected: number) {
    const r = await this.require(actor, id);
    if (r.revision !== expected) checked('CONFLICT');
    const s = await store.summary(id);
    if (r.host.state.result) checked(await store.clearFinished(r, expected));
    else {
      if (!s) throw new WildError('WILD_SETTLEMENT_MISSING', '结算事实缺失');
      checked(await store.finish(s, wildTerminal(s, 'player-abandoned')));
    }
    return { sessionId: id, revision: expected + 1 };
  }
  async expireDue() {
    for (const id of await store.due()) {
      try {
        const s = await store.summary(id);
        if (s) await store.finish(s, wildTerminal(s, 'expired'));
      } catch (error) {
        console.error('[combat-v6] wild expiry requires attention', {
          battleId: id,
          error,
        });
      }
    }
  }
  async view(r: WildRuntime, after = -1): Promise<WildSessionView> {
    const host = new WildHost(r.host, r.host);
    const state = host.state;
    const player = state.units.find((u) => u.id === host.playerId)!;
    return structuredClone({
      apiVersion: 1,
      sessionId: r.battleId,
      playback: liveReplayDelta(r.host.timeline, after),
      revision: r.revision,
      expiresAt: r.expiresAt,
      nodeId: r.metadata.payload.nodeId,
      combatVersions: state.versions,
      round: state.round,
      phase: state.phase,
      outcome: host.trace().outcome,
      itemRewards: host.finished ? (r.itemRewards ?? []) : [],
      settlement: host.finished
        ? (await store.lock(r.cultivatorId))
          ? 'pending'
          : 'settled'
        : 'not-started',
      units: combatV6Units(state, r.host.input.statusDefs ?? []),
      display: {
        ...combatV6Display(
          r.host.input.skills ?? [],
          r.host.input.statusDefs ?? [],
        ),
        unitNames: visibleUnitNames(state, r.host.events, host.playerId),
      },
      commandOptions: host.finished ? undefined : host.queryCommands(),
      controlledCommandOptions: host.finished
        ? undefined
        : host.controlledCommandOptions(),
      pendingCommand: player.command as CombatV6TrainingCommandV1 | undefined,
      events: r.host.events
        .map((event, seq) => ({ event: combatV6DisplayEvent(event), seq }))
        .filter((x) => x.seq > after),
      latestEventSeq: r.latestEventSeq,
    });
  }
}
export const wildSessions = new CombatV6WildSessionService();
import { hasActiveBreakthroughBattle } from './CombatV6BreakthroughOccupancy';
