import { GameplayTags } from '../../../shared/tag-domain';
import {
  adaptCombatSequenceV3ToVisualAction,
  projectCombatVisualAction,
  type CombatVisualActionInput,
} from '../../presentation';
import type { CombatSequenceV3 } from '../../v3/types';

describe('CombatVisualProjector', () => {
  it('projects a cast into ordered delivery, reaction, resolve and settle commands', () => {
    const action: CombatVisualActionInput = {
      id: 'action-1',
      sourceId: 'caster',
      targetIds: ['target'],
      ability: { id: 'skill-1', name: '问剑' },
      visual: {
        discipline: 'physical',
        delivery: 'melee',
        weight: 'heavy',
      },
      facts: [
        {
          id: 'fact-1',
          kind: 'damage',
          sourceId: 'caster',
          targetIds: ['target'],
          amount: 100,
          damageType: 'physical',
        },
        {
          id: 'fact-2',
          kind: 'damage',
          sourceId: 'target',
          targetIds: ['caster'],
          amount: 20,
          damageType: 'physical',
          damageSource: 'reflect',
          timing: 'after',
          reaction: { sourceId: 'target', label: '玄甲反震' },
        },
      ],
    };

    const timeline = projectCombatVisualAction(action);
    expect(timeline.commands.map((command) => command.kind)).toEqual([
      'cast',
      'delivery',
      'resolve',
      'impact_cue',
      'reaction',
      'resolve',
      'impact_cue',
      'settle',
    ]);
    expect(timeline.impactAt).toBeGreaterThan(700);
    expect(timeline.duration).toBeGreaterThan(timeline.impactAt);
  });

  it('aggregates one target impact and preserves true damage and shield values', () => {
    const action: CombatVisualActionInput = {
      id: 'action-impact',
      sourceId: 'caster',
      targetIds: ['target'],
      ability: { id: 'soul-art', name: '照魂' },
      visual: { discipline: 'true', delivery: 'projectile' },
      facts: [
        {
          id: 'fact-shielded',
          kind: 'damage',
          targetIds: ['target'],
          amount: 120,
          hpDamage: 80,
          shieldAbsorbed: 40,
          damageType: 'true',
        },
        {
          id: 'fact-true',
          kind: 'damage',
          targetIds: ['target'],
          amount: 26,
          hpDamage: 26,
          damageType: 'true',
          critical: true,
        },
      ],
    };

    const cues = projectCombatVisualAction(action).commands.filter(
      (command) => command.kind === 'impact_cue',
    );

    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({
      cue: {
        kind: 'damage',
        sourceId: 'caster',
        targetId: 'target',
        amount: 106,
        shieldAbsorbed: 40,
        damageType: 'true',
        critical: true,
      },
    });
  });

  it('deduplicates reaction labels and serializes reactions per unit', () => {
    const action: CombatVisualActionInput = {
      id: 'action-reaction-queue',
      sourceId: 'caster',
      targetIds: ['target'],
      ability: { id: 'skill', name: '问剑' },
      visual: { discipline: 'physical', delivery: 'melee' },
      facts: [
        {
          id: 'artifact-damage',
          kind: 'damage',
          targetIds: ['target'],
          amount: 10,
          damageType: 'physical',
          reaction: { sourceId: 'caster', label: '照胆镜' },
        },
        {
          id: 'artifact-resource',
          kind: 'resource',
          targetIds: ['caster'],
          resourceId: 'sword-intent',
          resourceName: '剑意',
          before: 1,
          after: 2,
          max: 6,
          reaction: { sourceId: 'caster', label: '照胆镜' },
        },
        {
          id: 'manual-status',
          kind: 'status',
          targetIds: ['caster'],
          operation: 'apply',
          statusId: 'sword-heart',
          statusName: '剑心',
          statusType: 'buff',
          reaction: { sourceId: 'caster', label: '太虚剑经' },
        },
        {
          id: 'target-reaction',
          kind: 'shield',
          targetIds: ['target'],
          operation: 'gain',
          amount: 12,
          reaction: { sourceId: 'target', label: '玄甲' },
        },
      ],
    };

    const timeline = projectCombatVisualAction(action);
    const reactions = timeline.commands.filter(
      (command) => command.kind === 'reaction',
    );

    expect(reactions).toHaveLength(3);
    expect(
      reactions.map((command) =>
        command.kind === 'reaction' ? command.fact.reaction?.label : undefined,
      ),
    ).toEqual(['照胆镜', '玄甲', '太虚剑经']);
    expect(reactions[1]?.at).toBeLessThan(
      (reactions[0]?.at ?? 0) + (reactions[0]?.duration ?? 0),
    );
    expect(reactions[2]?.at).toBeGreaterThanOrEqual(
      (reactions[0]?.at ?? 0) + (reactions[0]?.duration ?? 0) + 100,
    );
    const settle = timeline.commands.find(
      (command) => command.kind === 'settle',
    );
    const lastReactionEnd = Math.max(
      ...reactions.map((command) => command.at + command.duration),
    );
    expect(settle?.at).toBeGreaterThan(lastReactionEnd);
  });

  it('projects independent target cues and only aggregates HP recovery', () => {
    const action: CombatVisualActionInput = {
      id: 'action-field',
      sourceId: 'caster',
      targetIds: ['target-a', 'target-b'],
      ability: { id: 'field-art', name: '回春阵' },
      visual: { discipline: 'spell', delivery: 'field' },
      facts: [
        {
          id: 'fact-hp',
          kind: 'recovery',
          targetIds: ['target-a', 'target-b'],
          resource: 'hp',
          amount: 32,
        },
        {
          id: 'fact-mp',
          kind: 'recovery',
          targetIds: ['target-a', 'target-b'],
          resource: 'mp',
          amount: 20,
        },
      ],
    };

    const cues = projectCombatVisualAction(action).commands.filter(
      (command) => command.kind === 'impact_cue',
    );

    expect(cues).toHaveLength(2);
    expect(
      cues.map((command) =>
        command.kind === 'impact_cue' ? command.cue.targetId : undefined,
      ),
    ).toEqual(['target-a', 'target-b']);
    expect(cues.every((command) => command.cue.kind === 'recovery')).toBe(true);
  });

  it('adapts V3 combat facts and keeps an explicit visual override', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence-1',
      turn: 1,
      phase: 'action',
      actor: { id: 'caster', name: '甲' },
      ability: { id: 'soul-art', name: '照魂' },
      facts: [
        {
          id: 'fact-1',
          trace: {
            eventId: 'event-1',
            sequenceId: 'sequence-1',
            ordinal: 1,
          },
          origin: {
            kind: 'owned',
            owner: { id: 'caster', name: '甲' },
            carrier: { kind: 'ability', id: 'soul-art', name: '照魂' },
          },
          target: { id: 'target', name: '乙' },
          type: 'damage',
          amount: 60,
          beforeHp: 100,
          afterHp: 40,
          damageType: 'true',
          critical: false,
          shieldAbsorbed: 0,
        },
        {
          id: 'fact-2',
          trace: {
            eventId: 'event-2',
            sequenceId: 'sequence-1',
            ordinal: 2,
          },
          origin: {
            kind: 'owned',
            owner: { id: 'caster', name: '甲' },
            carrier: { kind: 'buff', id: 'soul-echo', name: '魂印回响' },
          },
          target: { id: 'caster', name: '甲' },
          type: 'shield',
          amount: 20,
          after: 20,
        },
      ],
    };

    const action = adaptCombatSequenceV3ToVisualAction(sequence, () => ({
      discipline: 'true',
      delivery: 'projectile',
      impact: 'bind',
    }));

    expect(action).toMatchObject({
      sourceId: 'caster',
      targetIds: ['target', 'caster'],
      visual: {
        discipline: 'true',
        delivery: 'projectile',
        distribution: 'fanout',
      },
    });
    expect(action?.facts[0]).toMatchObject({
      kind: 'damage',
      amount: 60,
      damageType: 'true',
    });
    expect(action?.facts[1]).toMatchObject({
      kind: 'shield',
      reaction: { sourceId: 'caster', label: '魂印回响' },
    });
  });

  it('does not allow an explicit projectile profile to override direct physical delivery', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence-physical-override',
      turn: 1,
      phase: 'action',
      actor: { id: 'caster', name: '甲' },
      ability: { id: 'body-breaker', name: '撼岳式' },
      facts: [
        {
          id: 'fact-physical-override',
          trace: {
            eventId: 'event-physical-override',
            sequenceId: 'sequence-physical-override',
            ordinal: 1,
          },
          origin: {
            kind: 'owned',
            owner: { id: 'caster', name: '甲' },
            carrier: { kind: 'ability', id: 'body-breaker', name: '撼岳式' },
          },
          target: { id: 'target', name: '乙' },
          type: 'damage',
          amount: 80,
          beforeHp: 100,
          afterHp: 20,
          damageType: 'physical',
          damageSource: 'direct',
          critical: false,
          shieldAbsorbed: 0,
        },
      ],
    };

    expect(
      adaptCombatSequenceV3ToVisualAction(sequence, () => ({
        discipline: 'spell',
        delivery: 'projectile',
        element: 'earth',
        impact: 'break',
        weight: 'heavy',
      })),
    ).toMatchObject({
      visual: {
        discipline: 'physical',
        delivery: 'melee',
        element: 'earth',
        impact: 'break',
        weight: 'heavy',
      },
    });
  });

  it('keeps ability-less system sequences projectable as ambient actions', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence-system',
      turn: 2,
      phase: 'round_start',
      facts: [
        {
          id: 'fact-system',
          trace: {
            eventId: 'event-system',
            sequenceId: 'sequence-system',
            ordinal: 1,
          },
          origin: {
            kind: 'system',
            carrier: { kind: 'system', id: 'status-clock', name: '状态流转' },
          },
          target: { id: 'target', name: '乙' },
          type: 'status',
          operation: 'remove',
          reason: 'expired',
          statusId: 'chilled',
          statusName: '寒滞',
          statusType: 'debuff',
          beforeLayers: 1,
          afterLayers: 0,
        },
      ],
    };

    expect(adaptCombatSequenceV3ToVisualAction(sequence)).toMatchObject({
      sourceId: 'target',
      ability: { id: 'status-clock', name: '状态流转' },
      visual: { delivery: 'self' },
    });
  });

  it('projects multi-target physical actions as one melee area delivery', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence-fanout',
      turn: 3,
      phase: 'action',
      actor: { id: 'caster', name: '甲' },
      ability: { id: 'sword-rain', name: '分影剑雨' },
      facts: ['target-a', 'target-b'].map((targetId, index) => ({
        id: `fact-fanout-${index + 1}`,
        trace: {
          eventId: `event-fanout-${index + 1}`,
          sequenceId: 'sequence-fanout',
          ordinal: index + 1,
        },
        origin: {
          kind: 'owned' as const,
          owner: { id: 'caster', name: '甲' },
          carrier: {
            kind: 'ability' as const,
            id: 'sword-rain',
            name: '分影剑雨',
          },
        },
        target: { id: targetId, name: index === 0 ? '乙' : '丙' },
        type: 'damage' as const,
        amount: 40,
        beforeHp: 100,
        afterHp: 60,
        damageType: 'physical' as const,
        critical: false,
        shieldAbsorbed: 0,
      })),
    };

    expect(adaptCombatSequenceV3ToVisualAction(sequence)).toMatchObject({
      targetIds: ['target-a', 'target-b'],
      visual: {
        discipline: 'physical',
        delivery: 'melee',
        distribution: 'fanout',
      },
    });
  });

  it('projects engine control tags into explicit name effects', () => {
    const sequence: CombatSequenceV3 = {
      id: 'sequence-control',
      turn: 4,
      phase: 'action',
      actor: { id: 'caster', name: '甲' },
      ability: { id: 'stun-art', name: '震神诀' },
      facts: [
        {
          id: 'fact-control',
          trace: {
            eventId: 'event-control',
            sequenceId: 'sequence-control',
            ordinal: 1,
          },
          origin: {
            kind: 'owned',
            owner: { id: 'caster', name: '甲' },
            carrier: { kind: 'ability', id: 'stun-art', name: '震神诀' },
          },
          target: { id: 'target', name: '乙' },
          type: 'status',
          operation: 'apply',
          transition: 'added',
          statusId: GameplayTags.STATUS.CONTROL.STUNNED,
          statusName: '眩晕',
          statusType: 'control',
          beforeLayers: 0,
          afterLayers: 1,
          duration: 2,
        },
      ],
    };

    expect(
      adaptCombatSequenceV3ToVisualAction(sequence)?.facts[0],
    ).toMatchObject({
      kind: 'status',
      statusType: 'control',
      controlVisual: 'stun',
    });
  });
});
