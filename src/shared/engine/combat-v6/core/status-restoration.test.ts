import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattle, SeededRng, type SkillDef, type StatusDef } from './index';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';

const seal: SkillDef = { id: 'seal', name: '封印', tags: ['spell', 'seal'], targeting: { side: 'enemy' }, effects: [{ type: 'applyStatus', statusId: 'control', duration: 3, hit: 'seal' }] };
function battle(chance: number, factor?: number, statusFactor?: number) {
  const guard: SkillDef = { id: 'guard', name: '抵抗', tags: ['passive'], targeting: { side: 'self' }, effects: [], innate: { sealHitTakenFactor: factor } };
  const b = createBattle({ seed: 1, versions, ruleset: createDaoyouRuleset({ formulas: { sealHitChance: () => chance } }),
    skills: [seal, guard], statusDefs: [{ id: 'control', name: '封印', kind: 'control', blocksSpell: true }, { id: 'buff', name: '增益', kind: 'buff', sealHitTakenFactor: statusFactor }],
    units: [{ id: 's', name: '施法者', kind: 'player', side: 0, attrs: { hp: 1000, speed: 100 }, skills: ['seal'] },
      { id: 't', name: '目标', kind: 'player', side: 1, attrs: { hp: 1000, speed: 1 }, passives: ['guard'] }],
  });
  if (statusFactor !== undefined) b.applyStatus('t', 'buff', 5);
  return b;
}
afterEach(() => vi.restoreAllMocks());
describe('封印概率乘区', () => {
  it.each([[.5, .7, undefined, .35], [.2, .7, undefined, .14], [.9, .7, .9, .567], [.5, undefined, undefined, .5]])(
    '正常概率 %s、被动倍率 %s、状态倍率 %s，实际按 %s 掷骰', (chance, factor, statusFactor, expected) => {
      const b = battle(chance, factor, statusFactor);
      const rolls = vi.spyOn(SeededRng.prototype, 'chance');
      b.submit('s', { type: 'skill', skillId: 'seal', targets: ['t'] }); b.submit('t', { type: 'defend' }); b.lockAndResolve();
      expect(rolls.mock.calls.some(([p]) => Math.abs(p - expected) < 1e-10)).toBe(true);
    },
  );
  it('必中施加的普通状态不经过封印倍率', () => {
    const b = battle(.5, .7); const rolls = vi.spyOn(SeededRng.prototype, 'chance');
    b.applyStatus('t', 'control', 3);
    expect(rolls).not.toHaveBeenCalled();
    expect(b.unit('t').statuses).toContainEqual(expect.objectContaining({ id: 'control' }));
  });
});

describe('宗门状态驱散边界', () => {
  it('仅移除可驱散宗门增益，保留其他来源、不可驱散状态及减益', () => {
    const statuses: StatusDef[] = [
      { id: 'school', kind: 'school', name: '门派增益', school: 'fixture', category: 'buff' },
      { id: 'item', kind: 'item', name: '装备增益', category: 'buff' },
      { id: 'form', kind: 'form', name: '不可驱散形态', school: 'fixture', category: 'buff', dispellable: false },
      { id: 'debuff', kind: 'debuff', name: '减益', school: 'fixture', category: 'debuff' },
    ];
    const skill: SkillDef = { id: 'dispel', name: '驱散', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'dispel', categories: ['buff'], schoolOnly: true }] };
    const b = createBattle({ seed: 1, versions, ruleset: createDaoyouRuleset(), skills: [skill], statusDefs: statuses,
      units: [{ id: 's', name: '施法者', kind: 'player', side: 0, attrs: { hp: 1000, speed: 100 }, skills: [skill.id] },
        { id: 't', name: '目标', kind: 'player', side: 1, attrs: { hp: 1000, speed: 1 } }],
    });
    for (const status of statuses) b.applyStatus('t', status.id, 5);
    b.submit('s', { type: 'skill', skillId: skill.id, targets: ['t'] }); b.submit('t', { type: 'defend' }); b.lockAndResolve();
    expect(b.unit('t').statuses.map(s => s.id)).toEqual(['item', 'form', 'debuff']);
  });
});
