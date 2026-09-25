import { db } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import {
  prepareWildBattle,
  readWildSearch,
  saveWildSearch,
} from '@server/lib/repositories/combatV6WildSearchRepository';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository';
import { findActiveSectMembership } from '@server/lib/repositories/sectCombatRepository';

import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6Display,
  combatV6DisplayEvent,
  combatV6Playback,
  combatV6Units,
  visibleUnitNames,
} from '@shared/combat-v6/presentation';
import { liveReplayDelta } from '@shared/combat-v6/replay-timeline';
import { publicUnitAppearances } from '@shared/combat-v6/unit-appearance';
import { QI_ACTION_COSTS } from '@shared/config/qiSystem';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import type {
  CombatV6TerminalOutboxV1,
  CombatV6TerminalReason,
} from '@shared/contracts/combatV6Runtime';
import type {
  WildRuntime,
  WildSessionView,
  WildSettlement,
} from '@shared/contracts/combatV6Wild';
import {
  wildEncounterView,
  type WildEncounter,
  type WildRegionView,
} from '@shared/contracts/combatV6Wild';
import { DOMAIN_EVENT_DEFINITIONS } from '@shared/contracts/domainEvents';
import { beastDeathIds } from '@shared/engine/combat-v6/beasts';
import { SeededRng } from '@shared/engine/combat-v6/core';
import { projectCharacterToCombatV6 } from '@shared/engine/combat-v6/projection';
import {
  getWildRegion,
  WILD_CONTENT_VERSION,
} from '@shared/engine/combat-v6/wild/content';
import {
  generateWildEncounter,
  generateWildIndividual,
} from '@shared/engine/combat-v6/wild/generator';
import { createWildHost, WildHost } from '@shared/engine/combat-v6/wild/host';
import { WILD_EXPLORATION_COOLDOWN_MS } from '@shared/engine/combat-v6/wild/rules';
import { evaluateFateContext } from '@shared/lib/fates';
import { WILD_DROP_POOLS, wildItemRewards } from '@shared/rewards/wild';

import { REALM_ORDER } from '@shared/types/constants';
import { eq } from 'drizzle-orm';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { playerCommandExecutor } from '../CommandExecutors';
import { ConditionService } from '../ConditionService';
import { qiCurrencyChange } from '../QiResourceChanges';
import { QiService } from '../QiService';

import { ResourceEventCommitter } from '../ResourceEventCommitter';
import { getCultivatorPreHeavenFates } from '../cultivator/CultivatorProfileRepository';
import { assembleCombatV6WildPlayer } from './CombatV6BuildService';
import { hasActiveCombat } from './CombatOccupancy';
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
          wildItemRewards(r.dropPool, (key) => {
            const rng = new SeededRng(rewardHash(key).readUInt32LE());
            return () => rng.next();
          }))
        : [],
    capturedBeasts: r.host.events.flatMap((event) => {
      if (event.type !== 'unitCaptured' || event.unitId !== r.host.playerId)
        return [];
      const target = r.host.combatants.find((c) => c.unitId === event.targetId);
      if (!target) throw new Error('CAPTURE_TARGET_MISSING');
      return [structuredClone(target.beast)];
    }),
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
  async region(actor: Actor, nodeId: string): Promise<WildRegionView> {
    const region = getWildRegion(nodeId);
    if (!region)
      throw new WildError('UNKNOWN_WILD_REGION', '此处尚未开放灵兽寻觅', 404);
    const activeId = await common.currentId(actor.cultivatorId);
    const activeTraining = activeId ? await common.get(activeId) : null;
    const search = await readWildSearch(actor.cultivatorId);
    const attempted = search?.preparedBattle;
    const consumed =
      attempted &&
      (Date.parse(attempted.expiresAt) <= Date.now() ||
        (await store.request(actor.cultivatorId, search.encounter.id)));
    return {
      ...region,
      qiCost: QI_ACTION_COSTS.wild_search,
      encounter:
        search?.encounter.nodeId === nodeId && !consumed
          ? wildEncounterView(search.encounter)
          : null,
      settlingBattleId: await store.lock(actor.cultivatorId),
      trainingSessionId: activeTraining?.battleId ?? null,
    };
  }
  private async assertAvailable(actor: Actor) {
    if (await hasActiveCombat(actor.cultivatorId)) {
      throw new WildError(
        'WILD_BATTLE_ALREADY_ACTIVE',
        '请先结束当前战斗与结算',
      );
    }
  }
  async explore(actor: Actor, nodeId: string, requestId: string) {
    const region = getWildRegion(nodeId);
    if (!region)
      throw new WildError('UNKNOWN_WILD_REGION', '此处尚未开放灵兽寻觅', 404);
    return playerCommandExecutor.executeWithLock({
      ...actor,
      source: 'wild_search',
      requestId,
      idempotency: { key: requestId, fingerprint: nodeId },
      command: async (tx) => {
        await this.assertAvailable(actor);
        const assembled = await assembleCombatV6WildPlayer(
          actor.cultivatorId,
          tx,
        );
        if (
          REALM_ORDER[assembled.player.cultivator.realm] <
          REALM_ORDER[region.realmRequirement]
        ) {
          throw new WildError(
            'WILD_REALM_REQUIRED',
            `此处需要达到${region.realmRequirement}期`,
            422,
          );
        }
        const previous = await readWildSearch(actor.cultivatorId, tx);
        const now = Date.now();
        if (
          previous &&
          now - Date.parse(previous.encounter.createdAt) <
            WILD_EXPLORATION_COOLDOWN_MS
        ) {
          throw new WildError('WILD_COOLDOWN', '请稍候再寻觅');
        }
        const seed = randomInt(0, 0x7fffffff);
        const encounter: WildEncounter = {
          id: randomUUID(),
          nodeId,
          seed,
          createdAt: new Date(now).toISOString(),
          combatants: generateWildEncounter(nodeId, seed).map((c, i) =>
            generateWildIndividual(
              c,
              randomUUID(),
              actor.cultivatorId,
              seed ^ ((i + 1) * 0x45d9f3b),
            ),
          ),
        };
        const actionInstanceId = `wild-search:${actor.cultivatorId}:${requestId}`;
        const qi = await QiService.reserveQi({
          cultivatorId: actor.cultivatorId,
          action: 'wild_search',
          actionInstanceId,
          metadata: { nodeId, encounterId: encounter.id },
          tx,
        });
        await saveWildSearch(actor.cultivatorId, encounter, tx);
        await QiService.commitReservation({ actionInstanceId, tx });
        return {
          result: wildEncounterView(encounter),
          resourceChanges: [qiCurrencyChange('wild.searched', qi)],
        };
      },
    });
  }
  async start(actor: Actor, encounterId: string) {
    return withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(actor.cultivatorId),
        context: 'wild-start',
        timeoutMs: 30000,
        retries: 0,
      },
      async (lease) => {
        const previous = await store.request(actor.cultivatorId, encounterId);
        if (previous) return this.get(actor, previous.battleId);
        await this.assertAvailable(actor);
        const runtime = await db.transaction(async (tx) => {
          await lockCultivatorForStateMutation(tx, actor.cultivatorId);
          const search = await readWildSearch(actor.cultivatorId, tx);
          if (!search || search.encounter.id !== encounterId) {
            throw new WildError(
              'WILD_ENCOUNTER_CHANGED',
              '寻觅结果已更新，请重新查看',
            );
          }
          const { encounter } = search;
          const region = getWildRegion(encounter.nodeId);
          if (!region)
            throw new WildError(
              'UNKNOWN_WILD_REGION',
              '此处尚未开放灵兽寻觅',
              404,
            );
          const assembled = await assembleCombatV6WildPlayer(
            actor.cultivatorId,
            tx,
          );
          if (
            REALM_ORDER[assembled.player.cultivator.realm] <
            REALM_ORDER[region.realmRequirement]
          ) {
            throw new WildError(
              'WILD_REALM_REQUIRED',
              `此处需要达到${region.realmRequirement}期`,
              422,
            );
          }
          if (search.preparedBattle) {
            const prepared = search.preparedBattle;
            if (
              Date.parse(prepared.expiresAt) <= Date.now() ||
              prepared.membershipId !== assembled.membershipId
            ) {
              throw new WildError(
                'WILD_ENCOUNTER_EXPIRED',
                '该次遭遇已结束，请重新寻觅',
              );
            }
            // Redis 尚未接收时重新读取人物状态；遭遇个体与战斗身份仍保持不变。
          }
          const projected = projectCharacterToCombatV6({
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
          const host = createWildHost(
            encounter.nodeId,
            encounter.seed,
            player,
            encounter.combatants,
          );
          const snapshot = host.runtimeSnapshot();
          const dropPool = WILD_DROP_POOLS[encounter.nodeId];
          if (!dropPool)
            throw new WildError(
              'WILD_REWARDS_MISSING',
              '该区域奖励尚未配置',
              422,
            );
          const r: WildRuntime = {
            dropPool: structuredClone(dropPool),
            runtimeVersion: 'combat_v6_redis_runtime_v1',
            battleId: encounter.id,
            ...actor,
            membershipId: assembled.membershipId,
            metadata: {
              schemaVersion: 1,
              sourceType: 'wild-encounter',
              battleType: 'pve',
              idempotencyKey: encounter.id,
              payload: {
                nodeId: encounter.nodeId,
                encounterContentVersion: WILD_CONTENT_VERSION,
                combatants: encounter.combatants.map(
                  ({ unitId, speciesId, level }) => ({
                    unitId,
                    speciesId,
                    level,
                  }),
                ),
              },
            },
            revision: 0,
            createdAt:
              search.preparedBattle?.createdAt ?? new Date(now).toISOString(),
            expiresAt:
              search.preparedBattle?.expiresAt ??
              new Date(now + 7200000).toISOString(),
            latestEventSeq: snapshot.events.length - 1,
            host: snapshot,
          };
          await prepareWildBattle(actor.cultivatorId, r, tx);
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
          lease.assertHeld();
          return r;
        });
        const p = runtime.host.state.units.find(
          (u) => u.id === runtime.host.playerId,
        )!;
        const summary = summaryOf(runtime, {
          hp: p.attrs.hp,
          mp: p.attrs.mp,
          maxHp: p.attrs.maxHp,
          maxMp: p.attrs.maxMp,
        });
        lease.assertHeld();
        const [status, id] = await store.create(runtime, summary, encounterId);
        if (status === 'EXISTING') {
          if (id !== runtime.battleId)
            throw new WildError(
              'WILD_BATTLE_ALREADY_ACTIVE',
              '请先结束当前战斗',
            );
          return this.get(actor, id);
        }
        if (status !== 'CREATED')
          throw new WildError(`WILD_${status}`, '当前无法开战，请稍后重试');
        return this.view(runtime);
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
    const membership = await findActiveSectMembership(actor.cultivatorId, db);
    if ((membership?.membershipId ?? null) !== r.membershipId) {
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
        { statusDefs: r.host.input.statusDefs },
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
          false,
        )
      : undefined;
    checked(await store.save(next, expected, nextSummary, event));
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
      controlledUnitId: host.playerId,
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
        unitAppearances: publicUnitAppearances(
          r.host.timeline.unitAppearances,
          visibleUnitNames(state, r.host.events, host.playerId),
        ),
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
