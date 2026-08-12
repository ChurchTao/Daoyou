import { describe, expect, it } from 'vitest';
import type { BattleMatchPlayerViewV1 } from '@shared/engine/battle-v5/match/types';
import {
  applyCombatVisualFactToSnapshot,
  BATTLE_PRESENTATION_DEFAULT_MAX_MS,
  createBattlePresentationWindow,
  compactBattlePresentationWindow,
  expandBattlePresentationWindow,
  createBattleRoundPlaybackPlan,
  createBattlePresentationSnapshot,
} from './BattlePresentation';

function view(): BattleMatchPlayerViewV1 {
  return {
    version: 'battle_match_player_view_v1',
    matchId: 'online-test',
    status: 'planning',
    revision: 4,
    playerId: 'p-a',
    teamId: 'alpha',
    controlledUnitIds: ['a0'],
    round: 2,
    checkpointRevision: 3,
    deadlineAt: 40_000,
    serverNow: 15_000,
    publicSnapshot: {
      version: 'battle_public_snapshot_v1',
      battleId: 'online-test',
      round: 2,
      checkpointRevision: 3,
      units: [
        {
          unitId: 'a0',
          teamId: 'alpha',
          slot: 0,
          name: '甲',
          alive: true,
          hp: { current: 90, max: 100, percent: 90 },
          mp: { current: 40, max: 60, percent: 66.67 },
          shield: 5,
          effects: [{
            id: 'focus-buff',
            label: '凝神',
            statusType: 'buff',
            layers: 2,
            remainingActions: 2,
            permanent: false,
          }],
          combatResources: [{ id: 'sword', name: '剑意', icon: '剑', current: 2, max: 5 }],
          actionStates: [{ id: 'queued:slash', type: 'queued_action', label: '蓄势', remainingActions: 1 }],
        },
        {
          unitId: 'b0',
          teamId: 'beta',
          slot: 0,
          name: '乙',
          alive: false,
          hp: { current: 0, max: 100, percent: 0 },
          mp: { current: 20, max: 60, percent: 33.33 },
          shield: 0,
          effects: [],
          combatResources: [],
          actionStates: [],
        },
      ],
    },
    ownSubmissions: {},
    ownCommitted: false,
  };
}

describe('BattlePresentation', () => {
  it('maps the viewer team to allies and the opponent to enemies', () => {
    const snapshot = createBattlePresentationSnapshot(view());
    expect(snapshot.version).toBe('battle_presentation_snapshot_v1');
    expect(snapshot.entities.map((entity) => entity.team)).toEqual([
      'allies',
      'enemies',
    ]);
    expect(snapshot.entities[0]).toMatchObject({
      id: 'a0',
      hp: 90,
      qi: 40,
      shield: 5,
      effects: [expect.objectContaining({ id: 'focus-buff', tone: 'buff' })],
      combatResources: [expect.objectContaining({ id: 'sword', current: 2 })],
      actionStates: [expect.objectContaining({ id: 'queued:slash', tone: 'preparing' })],
    });
    expect(snapshot.elapsedMs).toBe(5_000);
    expect(snapshot.focusedEntityId).toBe('a0');
  });

  it('builds non-overlapping beats and folds one actor turn together', () => {
    const origin = {
      kind: 'owned' as const,
      owner: { id: 'a0', name: '甲' },
      carrier: { kind: 'ability' as const, id: 'slash', name: '斩击' },
    };
    const fact = (id: string, targetId: string) => ({
      id,
      type: 'damage' as const,
      trace: { eventId: id, sequenceId: id, ordinal: 1 },
      origin,
      target: { id: targetId, name: targetId },
      amount: 10,
      beforeHp: 100,
      afterHp: 90,
      damageType: 'physical' as const,
      critical: false,
      shieldAbsorbed: 0,
    });
    const plan = createBattleRoundPlaybackPlan({
      version: 'battle_round_resolution_public_v1',
      commandSetId: 'set-1',
      round: 1,
      outcome: { battleEnded: false },
      sequences: [
        { id: 'pre', turn: 1, phase: 'action_pre', actor: origin.owner, facts: [fact('f1', 'b0')] },
        { id: 'action', turn: 1, phase: 'action', actor: origin.owner, ability: { id: 'slash', name: '斩击' }, facts: [fact('f2', 'b0')] },
        { id: 'other', turn: 2, phase: 'action', actor: { id: 'b0', name: '乙' }, ability: { id: 'counter', name: '反击' }, facts: [{ ...fact('f3', 'a0'), origin: { ...origin, owner: { id: 'b0', name: '乙' } } }] },
      ],
    });

    expect(plan.beats).toHaveLength(2);
    expect(plan.beats[0].timeline.action.facts).toHaveLength(2);
    expect(plan.beats[0].timeline.action.ability).toEqual({ id: 'slash', name: '斩击' });
    expect(plan.beats[1].startAt).toBeGreaterThanOrEqual(plan.beats[0].duration);
    expect(plan.durationMs).toBe(plan.beats[1].startAt + plan.beats[1].duration);
  });

  it('updates renderer state only when a visual fact resolves', () => {
    const initial = createBattlePresentationSnapshot(view());
    const next = applyCombatVisualFactToSnapshot(initial, {
      id: 'hit',
      kind: 'damage',
      sourceId: 'b0',
      targetIds: ['a0'],
      amount: 25,
      hpDamage: 20,
      shieldAbsorbed: 5,
      damageType: 'physical',
    }, 1_500);
    expect(next.entities[0]).toMatchObject({ hp: 70, shield: 0 });
    expect(initial.entities[0]).toMatchObject({ hp: 90, shield: 5 });
  });

  it('preserves a valid focus while falling back to a live owned unit', () => {
    const next = createBattlePresentationSnapshot(view(), 'b0');
    expect(next.focusedEntityId).toBe('b0');

    const fallback = createBattlePresentationSnapshot(view(), 'missing');
    expect(fallback.focusedEntityId).toBe('a0');
  });

  it('compresses the playback plan into the authoritative window', () => {
    const plan = {
      version: 'battle_round_playback_plan_v1' as const,
      commandSetId: 'set-long',
      round: 3,
      durationMs: 25_000,
      beats: [{
        index: 0,
        actorId: 'a0',
        actionId: 'long-action',
        sequenceIds: ['long-sequence'],
        startAt: 5_000,
        duration: 20_000,
        timeline: {
          action: {
            id: 'long-action',
            sourceId: 'a0',
            targetIds: ['b0'],
            ability: { id: 'slash', name: '斩击' },
            visual: { discipline: 'physical', delivery: 'melee' },
            facts: [],
          },
          duration: 20_000,
          impactAt: 10_000,
          commands: [{
            id: 'settle',
            kind: 'settle' as const,
            at: 19_000,
            duration: 1_000,
          }],
        },
      }],
    };
    const window = createBattlePresentationWindow({
      resultId: 'result-3',
      startedAt: 10_000,
      startingPublicSnapshot: view().publicSnapshot,
      plan,
    });
    expect(window.readyAcceptedAt).toBe(11_500);
    expect(window.scheduledEndsAt).toBe(
      10_000 + BATTLE_PRESENTATION_DEFAULT_MAX_MS,
    );
    expect(window.plan.durationMs).toBe(BATTLE_PRESENTATION_DEFAULT_MAX_MS);
    expect(window.plan.beats[0]?.startAt).toBeLessThan(
      BATTLE_PRESENTATION_DEFAULT_MAX_MS,
    );
    for (const beat of window.plan.beats) {
      expect(beat.startAt + beat.duration).toBeLessThanOrEqual(
        BATTLE_PRESENTATION_DEFAULT_MAX_MS,
      );
      for (const command of beat.timeline.commands) {
        expect(beat.startAt + command.at + command.duration).toBeLessThanOrEqual(
          BATTLE_PRESENTATION_DEFAULT_MAX_MS,
        );
      }
    }
  });

  it('transports each visual fact once and reconstructs the renderer plan', () => {
    const origin = {
      kind: 'owned' as const,
      owner: { id: 'a0', name: '甲' },
      carrier: { kind: 'ability' as const, id: 'slash', name: '斩击' },
    };
    const fact = {
      id: 'compact-fact',
      type: 'damage' as const,
      trace: { eventId: 'compact-fact', sequenceId: 'compact-sequence', ordinal: 1 },
      origin,
      target: { id: 'b0', name: '乙' },
      amount: 10,
      beforeHp: 100,
      afterHp: 90,
      damageType: 'physical' as const,
      critical: false,
      shieldAbsorbed: 0,
    };
    const resolution = createBattleRoundPlaybackPlan({
      version: 'battle_round_resolution_public_v1',
      commandSetId: 'compact-set',
      round: 4,
      outcome: { battleEnded: false },
      sequences: [{
        id: 'compact-sequence',
        turn: 1,
        phase: 'action',
        actor: origin.owner,
        ability: origin.carrier,
        facts: [fact],
      }],
    });
    const original = createBattlePresentationWindow({
      resultId: 'compact-result',
      startedAt: 20_000,
      startingPublicSnapshot: view().publicSnapshot,
      plan: resolution,
    });
    const compact = compactBattlePresentationWindow(original);
    expect(compact.facts).toHaveLength(1);
    expect(expandBattlePresentationWindow(compact)).toEqual(original);
    expect(JSON.stringify(compact)).not.toContain('"fact":');
    expect(JSON.stringify(compact).length).toBeLessThan(
      JSON.stringify(original).length,
    );
  });
});
