import { describe, expect, it } from 'vitest';
import { createUnit } from './units.js';
import { evalExpr } from './expr.js';
import type { ExprEnv, SkillDef, StatusDef } from './types.js';

function fixture() {
  const source = createUnit({ id: 'caster', name: 'caster', side: 0, kind: 'player', level: 180, attrs: { hp: 100, maxHp: 100 }, passives: ['canon'], skillLevels: { canon: 120 } }, 0);
  const target = createUnit({ id: 'target', name: 'target', side: 1, kind: 'player', level: 180, attrs: { hp: 100, maxHp: 100 } }, 1);
  const env: ExprEnv = { source, target, skillLevel: 180, targets: 1, state: { round: 3, units: [source, target] } };
  return { source, target, env };
}

function mark(sourceId: string, appliedRound: number) {
  return { id: 'mark', kind: 'mark', sourceId, appliedRound, remainingRounds: 5, stacks: 1, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1 };
}

describe('contextual expressions', () => {
  it('reads the known source method level rather than the triggering skill level', () => {
    const { source, env } = fixture();
    source.wound = 25;
    expect(evalExpr('knownSkillLevel.canon / 24', env)).toBe(5);
    expect(evalExpr('knownSkillLevel.unknown', env)).toBe(0);
    expect(evalExpr('source.maxHp - source.wound - source.hp', env)).toBe(-25);
    env.statusDuration = 4;
    expect(evalExpr('statusDuration', env)).toBe(4);
  });

  it('counts owned enemy player marks including downed units, without borrowing another source', () => {
    const { source, target, env } = fixture();
    target.flags.downed = true;
    target.statuses.push(mark(source.id, 1));
    const other = createUnit({ id: 'other', name: 'other', side: 1, kind: 'player', level: 180, attrs: { hp: 100, maxHp: 100 } }, 2);
    other.statuses.push(mark('another-caster', 1));
    const pet = createUnit({ id: 'pet', name: 'pet', side: 1, kind: 'pet', level: 180, attrs: { hp: 100, maxHp: 100 } }, 3);
    pet.statuses.push(mark(source.id, 1));
    env.state!.units.push(other, pet);
    expect(evalExpr('enemyPlayerCount', env)).toBe(2);
    expect(evalExpr('ownedEnemyStatusCount.mark', env)).toBe(1);
    expect(evalExpr('targetStatusAge.mark', env)).toBe(2);
    target.statuses[0].sourceId = 'another-caster';
    expect(evalExpr('targetStatusAge.mark', env)).toBe(0);
  });

  it('isolates attacker history and first-action guard budgets by round and source', () => {
    const { source, target, env } = fixture();
    source.flags.hostileActionGuardRound = 3;
    target.flags.hostileActionGuardRound = 2;
    target.combatFacts = { [`spellAttackedRound:${source.id}`]: 3, [`spellHitRound:${source.id}`]: 2, 'spellHitRound:someone-else': 3 };
    expect(evalExpr('guardUsedThisRound', env)).toBe(1);
    expect(evalExpr('targetGuardUsedThisRound', env)).toBe(0);
    expect(evalExpr('targetSpellAttackedBySourceThisRound', env)).toBe(1);
    expect(evalExpr('targetSpellHitBySourceThisRound', env)).toBe(0);
    env.state!.round = 4;
    expect(evalExpr('guardUsedThisRound', env)).toBe(0);
    expect(evalExpr('targetSpellAttackedBySourceThisRound', env)).toBe(0);
  });

  it('resolves revive restrictions and delayed revival from definitions rather than status names', () => {
    const { source, target, env } = fixture();
    const definitions: StatusDef[] = [{ id: 'block', kind: 'arbitrary', name: 'block', blocksRevive: true }, { id: 'silence', kind: 'arbitrary', name: 'silence', blocksNonArtSkills: true }];
    env.statusDefs = new Map(definitions.map(def => [def.id, def]));
    source.statuses.push({ ...mark(source.id, 1), id: 'block' }, { ...mark(source.id, 1), id: 'silence' });
    const ghost: SkillDef = { id: 'delayed', name: 'delayed', tags: ['passive'], targeting: { side: 'self' }, effects: [], innate: { delayedRevivalRounds: 5 } };
    target.passives.push(ghost.id);
    env.skills = new Map([[ghost.id, ghost]]);
    expect(evalExpr('reviveBlocked', env)).toBe(1);
    expect(evalExpr('sourceSpellBlocked', env)).toBe(1);
    expect(evalExpr('targetDelayedRevival', env)).toBe(1);
    env.state!.result = { winner: 1, reason: 'wipe' };
    expect(evalExpr('combatEnded', env)).toBe(1);
  });
});
