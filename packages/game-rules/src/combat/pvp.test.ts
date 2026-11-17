import { describe, expect, it } from 'vitest';
import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import type { CreateBattleInput, SkillDef } from '@daoyou/combat-core/types';
import { COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS } from '@daoyou/game-domain/combat';
import { arenaBattle } from './arena.js';
import { daoyouRulesetV6 } from './daoyou/index.js';
import { observeAutoBattle } from './auto-observation.js';
import { rankAutoActions } from './auto-utility.js';
import { PVP_FATIGUE_RULESET_VERSION, pvpRecoveryMultiplier } from './pvp.js';

const versions = { ...COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS, rulesetVersion: PVP_FATIGUE_RULESET_VERSION };
const skill = (id: string, effects: SkillDef['effects']): SkillDef => ({ id, name: id, tags: ['spell'], targeting: { side: 'self' }, effects });
function input(skills: SkillDef[]): CreateBattleInput {
  return { seed: 4, versions, ruleset: daoyouRulesetV6, skills,
    units: [
      { id: 'a', name: '甲', kind: 'player', side: 0, attrs: { hp: 100, maxHp: 2000, mp: 100, maxMp: 1000, speed: 100 }, skills: skills.map(s => s.id) },
      { id: 'b', name: '乙', kind: 'player', side: 1, attrs: { hp: 2000, maxHp: 2000 } },
    ] };
}
function round(b: ReturnType<typeof createBattle>, id?: string) {
  b.submit('a', id ? { type: 'skill', skillId: id, targets: ['a'] } : { type: 'defend' });
  b.submit('b', { type: 'defend' });
  b.lockAndResolve();
}

describe('PvP 久战衰减', () => {
  it.each([[30, 1], [31, .98], [40, .8], [50, .6], [60, .4], [100, .4]])('第 %i 回合恢复倍率为 %s', (round, expected) => {
    expect(pvpRecoveryMultiplier({ round, versions })).toBe(expected);
    expect(pvpRecoveryMultiplier({ round, versions: COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS })).toBe(1);
  });

  it.each(['heal', 'fixedHeal', 'restore', 'revive', 'restoreRevive'] as const)('%s 仅在最终恢复结算衰减一次', kind => {
    const action = skill('recover', kind === 'heal' || kind === 'fixedHeal'
      ? [{ type: 'heal', power: 500, fixedBase: kind === 'fixedHeal' }]
      : kind === 'revive' ? [{ type: 'revive', hp: 500 }]
      : [{ type: 'restoreHp', power: 500, revive: kind === 'restoreRevive' }]);
    const revive = kind === 'revive' || kind === 'restoreRevive';
    if (revive) action.targeting = { side: 'ally', includeDowned: true, onlyDowned: true };
    const config = input([action]);
    const b = createBattle(config);
    b.state.round = 60;
    if (revive) {
      b.unit('b').side = 0;
      b.unit('b').attrs.hp = 0;
      b.unit('b').flags.downed = true;
      // Keep a standing opponent while reviving an ally.
      b.state.units.push({ ...structuredClone(b.unit('a')), id: 'enemy', side: 1 });
      b.submit('a', { type: 'skill', skillId: 'recover', targets: ['b'] });
      b.submit('enemy', { type: 'defend' });
      b.lockAndResolve();
      expect(b.unit('b').attrs.hp).toBe(200);
      expect(b.unit('b').flags.downed).toBe(false);
    } else {
      round(b, 'recover');
      expect(b.unit('a').attrs.hp).toBe(300);
    }
  });

  it('吸血、回合末恢复均衰减，回蓝保持原量', () => {
    const leech = skill('leech', [{ type: 'fixedHit', power: 100 }]);
    leech.targeting = { side: 'enemy' };
    leech.hooks = [{ on: 'onBeHit', sourceIsSelf: true, aim: 'self', when: { skillIds: ['leech'] }, effects: [{ type: 'restoreHp', power: 'hpDamage' }] }];
    const passive: SkillDef = { ...skill('regen', []), tags: ['passive'], hooks: [{ on: 'onRoundEnd', aim: 'self', effects: [{ type: 'restoreHp', power: 100 }, { type: 'restoreMp', power: 100 }] }] };
    const config = input([leech, passive]);
    config.units[0].passives = [passive.id];
    const b = createBattle(config);
    b.state.round = 60;
    b.submit('a', { type: 'skill', skillId: 'leech', targets: ['b'] });
    b.submit('b', { type: 'defend' });
    b.lockAndResolve();
    expect(b.unit('a').attrs.hp).toBe(180);
    expect(b.unit('a').attrs.mp).toBe(200);
    expect(b.unit('b').attrs.hp).toBe(1900);
  });

  it('护盾不衰减，自然复活按复起回合衰减', () => {
    const barrier = skill('shield', [{ type: 'applyBarrier', id: 'shield', kind: 'shield', name: '护盾', power: 500, duration: 3 }]);
    const config = input([barrier]);
    config.units.push({ id: 'pet', name: '灵兽', kind: 'pet', side: 0, ownerId: 'a', attrs: { hp: 0, maxHp: 1000 } });
    const b = createBattle(config);
    b.state.round = 59;
    b.unit('pet').flags.dead = true;
    b.unit('pet').flags.reviveAtRound = 60;
    round(b, 'shield');
    expect(b.unit('a').barriers[0].current).toBe(500);
    expect(b.unit('pet').attrs.hp).toBe(400);
    expect(b.unit('pet').flags.dead).toBe(false);
  });

  it('新切磋启用，PvE及旧战局不启用；跨30回合恢复快照保持一致', () => {
    const config = input([skill('heal', [{ type: 'heal', power: 100 }])]);
    const runtime = { seed: config.seed, units: config.units, skills: config.skills!, statusDefs: [] };
    const b = arenaBattle(runtime);
    expect(b.state.versions.rulesetVersion).toBe(PVP_FATIGUE_RULESET_VERSION);
    b.state.round = 30;
    const restored = arenaBattle({ ...runtime, state: b.snapshot(), events: b.log() });
    for (const session of [b, restored]) { round(session, 'heal'); round(session, 'heal'); }
    expect(b.unit('a').attrs.hp).toBe(298);
    expect(restored.snapshot()).toEqual(b.snapshot());
    expect(restored.log()).toEqual(b.log());
    const pve = arenaBattle({ ...runtime, units: config.units.map(u => u.id === 'b' ? { ...u, kind: 'npc' } : u) });
    pve.state.round = 60; round(pve, 'heal');
    expect(pve.unit('a').attrs.hp).toBe(200);
    const legacy = createBattle({ ...config, versions: COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS });
    legacy.state.round = 60;
    const old = arenaBattle({ ...runtime, state: legacy.snapshot(), events: legacy.log() });
    round(old, 'heal'); expect(old.unit('a').attrs.hp).toBe(200);
  });

  it('自动战斗的治疗估值与实际衰减一致，恢复快照也保留规则', () => {
    const config = input([skill('heal', [{ type: 'heal', power: 500 }])]);
    const b = createBattle(config); b.state.round = 60;
    const ranked = rankAutoActions(observeAutoBattle(b.state, 'a', []), 'a', config.skills!, [], b.queryCommands('a'));
    const heal = ranked.find(c => c.command.type === 'skill');
    expect(heal?.intents.find(i => i.targetId === 'a')?.healing).toBe(200);
    const restored = restoreBattle(config, b.snapshot(), b.log());
    round(restored, 'heal'); expect(restored.unit('a').attrs.hp).toBe(300);
  });
});
