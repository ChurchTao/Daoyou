import { db } from '@server/lib/drizzle/db';
import { findActiveCombatV6Membership } from '@server/lib/repositories/combatV6BuildRepository';
import { COMBAT_V6_TRAINING_ERROR_CODE, type CombatV6TrainingCommandV1, type CombatV6TrainingSessionViewV1 } from '@shared/contracts/combatV6';
import { COMBAT_V6_REPLAY_VERSION, CombatV6BattleFinishedRecordV1Schema, type CombatV6BattleFinishedRecordV1, type CombatV6RedisRuntimeV1, type CombatV6ReplayV1, type CombatV6TerminalOutboxV1, type CombatV6TerminalReason } from '@shared/contracts/combatV6Runtime';
import { DOMAIN_EVENT_DEFINITIONS, parseDomainEventEnvelope, type DomainEventEnvelope } from '@shared/contracts/domainEvents';
import { COMBAT_V6_TRAINING_ENCOUNTERS_V1, createCombatV6TrainingHostV1, restoreCombatV6TrainingHostV1, TrainingHostError, type CombatV6TrainingHostV1, type CombatV6TrainingTierV1, type TrainingEncounterOutcome } from '@shared/engine/combat-v6/encounter';
import { randomInt, randomUUID } from 'node:crypto';
import { assembleCombatV6TrainingPlayer, CombatV6BuildError } from './CombatV6BuildService';
import { CombatV6RuntimeStore } from './CombatV6RuntimeStore';
import { CombatV6WildStore } from './CombatV6WildStore';

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
type Actor = { userId: string; cultivatorId: string };

export class CombatV6TrainingSessionError extends Error {
  constructor(readonly code: string, message: string, readonly status: 400 | 404 | 409 | 422 = 409) { super(message); this.name = 'CombatV6TrainingSessionError'; }
}

export class CombatV6TrainingSessionService {
  constructor(private readonly store = new CombatV6RuntimeStore()) {}

  async create(actor: Actor, encounterId: string, tier: CombatV6TrainingTierV1) {
    if (await new CombatV6WildStore().lock(actor.cultivatorId)) throw this.error('AlreadyActive', '野外战斗或资源结算尚未结束');
    const currentId = await this.store.currentId(actor.cultivatorId);
    if (currentId) {
      const current = await this.store.get(currentId);
      if (current && Date.parse(current.expiresAt) > Date.now()) {
        if (current.metadata.payload.encounterId === encounterId && current.metadata.payload.tier === tier) return this.view(current, -1);
        throw this.error('AlreadyActive', '已有进行中的训练，请先继续或结束该训练');
      }
      if (current) await this.expire(current);
    }
    const assembled = await assembleCombatV6TrainingPlayer(actor.cultivatorId, db);
    const seed = randomInt(0, 0x7fffffff);
    const created = createCombatV6TrainingHostV1({ encounterId, tier, seed, player: assembled.player });
    if (!created.ok) throw new CombatV6BuildError('COMBAT_V6_PLAYER_PROJECTION_FAILED', created.diagnostics.map((item) => `${item.code}: ${item.message}`).join('; '), 422);
    const battleId = randomUUID(); const now = Date.now();
    const runtime: CombatV6RedisRuntimeV1 = {
      runtimeVersion: 'combat_v6_redis_runtime_v1', battleId, userId: actor.userId, cultivatorId: actor.cultivatorId,
      membershipId: assembled.membershipId, buildRevision: assembled.buildRevision,
      metadata: { schemaVersion: 1, sourceType: 'training-room', battleType: 'training', idempotencyKey: randomUUID(), payload: { encounterId, tier } },
      revision: 0, createdAt: new Date(now).toISOString(), expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
      latestEventSeq: created.host.trace().events.length - 1, host: created.host.runtimeSnapshot(),
    };
    const result = await this.store.create(runtime);
    if (result.status !== 'created') {
      const existing = await this.store.get(result.battleId);
      if (existing && existing.metadata.payload.encounterId === encounterId && existing.metadata.payload.tier === tier) return this.view(existing, -1);
      throw this.error('AlreadyActive', '已有进行中的训练，请先继续或结束该训练');
    }
    return this.view(runtime, -1);
  }

  async current(actor: Actor, afterEventSeq = -1): Promise<CombatV6TrainingSessionViewV1 | null> {
    const id = await this.store.currentId(actor.cultivatorId); if (!id) return null;
    const runtime = await this.store.get(id); if (!runtime || runtime.userId !== actor.userId) return null;
    await this.ensureUsable(runtime); return this.view(runtime, afterEventSeq);
  }
  async get(actor: Actor, battleId: string, afterEventSeq = -1) { const runtime = await this.require(actor, battleId); return this.view(runtime, afterEventSeq); }

  async submit(actor: Actor, battleId: string, expectedRevision: number, unitId: string, command: CombatV6TrainingCommandV1) {
    const runtime = await this.require(actor, battleId); this.assertRevision(runtime, expectedRevision); const host = this.restore(runtime);
    try { host.submit(unitId, structuredClone(command)); } catch (error) { if (error instanceof TrainingHostError) throw this.error('CommandNotAllowed', error.message, 400); throw error; }
    const next = this.nextRuntime(runtime, host); await this.save(next, expectedRevision); return this.view(next, runtime.latestEventSeq);
  }

  async resolve(actor: Actor, battleId: string, expectedRevision: number) {
    const runtime = await this.require(actor, battleId); this.assertRevision(runtime, expectedRevision); const host = this.restore(runtime);
    if (host.finished) return this.view(runtime, runtime.latestEventSeq);
    try { host.resolveRound(); } catch (error) { if (error instanceof TrainingHostError) throw this.error('RoundNotReady', error.message); throw error; }
    const next = this.nextRuntime(runtime, host);
    let terminal: CombatV6TerminalOutboxV1 | undefined; let archive: CombatV6ReplayV1 | undefined;
    if (host.finished) {
      const outcome = host.trace().outcome!; const reason: CombatV6TerminalReason = outcome === 'aborted' ? 'fled' : 'battle-ended';
      terminal = this.terminalEvent(next, outcome, reason, true); archive = this.replay(next, host);
    }
    await this.save(next, expectedRevision, terminal, archive); return this.view(next, runtime.latestEventSeq);
  }

  async abandon(actor: Actor, battleId: string, expectedRevision: number) {
    const runtime = await this.require(actor, battleId); this.assertRevision(runtime, expectedRevision); const host = this.restore(runtime);
    const terminal = host.finished ? undefined : this.terminalEvent(runtime, 'aborted', 'player-abandoned', false);
    this.assertStoreResult(await this.store.remove(runtime, expectedRevision, terminal));
    return { sessionId: battleId, revision: expectedRevision + 1, outcome: 'aborted' as const };
  }

  async trace(actor: Actor, battleId: string) { return this.restore(await this.require(actor, battleId)).trace(); }
  async expireDue(): Promise<number> { const ids = await this.store.dueBattleIds(); let count = 0; for (const id of ids) { const runtime = await this.store.get(id); if (runtime && Date.parse(runtime.expiresAt) <= Date.now()) { await this.expire(runtime); count += 1; } } return count; }

  private async require(actor: Actor, battleId: string) { const runtime = await this.store.get(battleId); if (!runtime || runtime.userId !== actor.userId || runtime.cultivatorId !== actor.cultivatorId) throw this.notFound(); await this.ensureUsable(runtime); return runtime; }
  private async ensureUsable(runtime: CombatV6RedisRuntimeV1) {
    if (Date.parse(runtime.expiresAt) <= Date.now()) { await this.expire(runtime); throw this.notFound(); }
    const restored = restoreCombatV6TrainingHostV1(runtime.host);
    if (!restored.ok) {
      await this.store.remove(runtime, runtime.revision, this.terminalEvent(runtime, 'aborted', 'technical-abort', false));
      throw this.error('CommandNotAllowed', '训练运行态与当前版本不兼容', 422);
    }
    const membership = await findActiveCombatV6Membership(runtime.cultivatorId, db); if (membership?.membershipId === runtime.membershipId) return;
    await this.store.remove(runtime, runtime.revision, runtime.host.state.result ? undefined : this.terminalEvent(runtime, 'aborted', 'membership-changed', false)); throw this.error('MembershipChanged', '当前宗门已经变化，本次训练已失效');
  }
  private restore(runtime: CombatV6RedisRuntimeV1): CombatV6TrainingHostV1 { const result = restoreCombatV6TrainingHostV1(runtime.host); if (!result.ok) throw this.error('CommandNotAllowed', '训练运行态无法恢复', 422); return result.host; }
  private nextRuntime(runtime: CombatV6RedisRuntimeV1, host: CombatV6TrainingHostV1): CombatV6RedisRuntimeV1 { const snapshot = host.runtimeSnapshot(); return { ...structuredClone(runtime), revision: runtime.revision + 1, latestEventSeq: snapshot.events.length - 1, host: snapshot }; }

  private terminalEvent(runtime: CombatV6RedisRuntimeV1, outcome: TrainingEncounterOutcome, reason: CombatV6TerminalReason, replayExpected: boolean): CombatV6TerminalOutboxV1 {
    const record: CombatV6BattleFinishedRecordV1 = CombatV6BattleFinishedRecordV1Schema.parse({ battleId: runtime.battleId, cultivatorId: runtime.cultivatorId, metadata: runtime.metadata, combatVersions: runtime.host.state.versions, startedAt: runtime.createdAt, finishedAt: new Date().toISOString(), round: runtime.host.state.round, outcome, reason, replayExpected });
    const definition = DOMAIN_EVENT_DEFINITIONS['combat.v6.battle.finished'];
    const event = parseDomainEventEnvelope({ id: randomUUID(), type: 'combat.v6.battle.finished', version: definition.version, subject: definition.subject, occurredAt: record.finishedAt, aggregate: { type: 'combat-v6-battle', id: runtime.battleId }, correlationId: runtime.metadata.idempotencyKey, data: { battleId: runtime.battleId } }) as DomainEventEnvelope<'combat.v6.battle.finished'>;
    return { version: 'combat_v6_terminal_outbox_v1', event: event as CombatV6TerminalOutboxV1['event'], record };
  }
  private replay(runtime: CombatV6RedisRuntimeV1, host: CombatV6TrainingHostV1): CombatV6ReplayV1 { const trace = host.trace(); if (!trace.finalState || !trace.outcome) throw new Error('Cannot archive unfinished combat-v6 battle'); return { ...trace, replayVersion: COMBAT_V6_REPLAY_VERSION, battleId: runtime.battleId, cultivatorId: runtime.cultivatorId, metadata: runtime.metadata, startedAt: runtime.createdAt, finishedAt: new Date().toISOString(), finalState: trace.finalState, outcome: trace.outcome }; }
  private async expire(runtime: CombatV6RedisRuntimeV1) { await this.store.remove(runtime, runtime.revision, runtime.host.state.result ? undefined : this.terminalEvent(runtime, 'aborted', 'expired', false)); }
  private async save(runtime: CombatV6RedisRuntimeV1, expected: number, terminal?: unknown, replay?: unknown) { this.assertStoreResult(await this.store.save(runtime, expected, terminal, replay)); }
  private assertRevision(runtime: CombatV6RedisRuntimeV1, expected: number) { if (runtime.revision !== expected) throw this.error('RevisionConflict', '训练状态已经变化，请刷新后重试'); }
  private assertStoreResult(result: 'ok' | 'conflict' | 'not-found') { if (result === 'conflict') throw this.error('RevisionConflict', '训练状态已经变化，请刷新后重试'); if (result === 'not-found') throw this.notFound(); }
  private notFound() { return this.error('NotFound', '训练会话不存在或已经过期', 404); }
  private error(key: keyof typeof COMBAT_V6_TRAINING_ERROR_CODE, message: string, status: 400 | 404 | 409 | 422 = 409) { return new CombatV6TrainingSessionError(COMBAT_V6_TRAINING_ERROR_CODE[key], message, status); }

  private view(runtime: CombatV6RedisRuntimeV1, afterEventSeq: number): CombatV6TrainingSessionViewV1 {
    const host = this.restore(runtime); const state = host.state; const events = runtime.host.events; const player = state.units.find((unit) => unit.id === host.playerId);
    return structuredClone({ apiVersion: 1, sessionId: runtime.battleId, revision: runtime.revision, expiresAt: runtime.expiresAt, encounterId: runtime.metadata.payload.encounterId, tier: runtime.metadata.payload.tier, combatVersions: state.versions, round: state.round, phase: state.phase, ...(host.finished ? { outcome: host.trace().outcome } : {}), units: state.units.map((unit) => ({ id: unit.id, name: unit.name, side: unit.side, slot: unit.slot, hp: unit.attrs.hp, maxHp: unit.attrs.maxHp, mp: unit.attrs.mp, maxMp: unit.attrs.maxMp, wound: unit.wound, downed: unit.flags.downed, dead: unit.flags.dead, escaped: unit.flags.escaped, statuses: unit.statuses.map((status) => ({ id: status.id, remainingRounds: status.remainingRounds, stacks: status.stacks })), barriers: unit.barriers.map((barrier) => ({ id: barrier.id, name: barrier.name, current: barrier.current, remainingRounds: barrier.remainingRounds })), resources: unit.resources.map((resource) => ({ ...resource })) })), ...(!host.finished ? { commandOptions: host.queryCommands() } : {}), ...(player?.command ? { pendingCommand: player.command as CombatV6TrainingCommandV1 } : {}), events: events.map((event, seq) => ({ seq, event })).filter((event) => event.seq > afterEventSeq), latestEventSeq: events.length - 1 });
  }
}

export const combatV6TrainingSessionStore = new CombatV6TrainingSessionService();
export const COMBAT_V6_TRAINING_CONTENT_VIEW = Object.freeze({ tiers: [60, 120, 180] as const, encounters: COMBAT_V6_TRAINING_ENCOUNTERS_V1.map(({ id, name }) => ({ id, name })) });
