import { describe, expect, it } from 'vitest';
import { compileCharacterPanelV1 } from '../projection/character-panel-v1';
import { resolveCombatCapabilitiesV1 } from './capabilities';
import {
  compileCharacterManualsV1,
  getManualSlotCount,
  validateManualStateV1,
  withManualAttributes,
} from './compiler';
import { MANUAL_PACK } from './content';
import { loadManualPack } from './pack';
import { changeManual } from './state';
import type { CultivatorManualStateV1 } from './types';

const id = 'character_manual.changchun';
const empty = (): CultivatorManualStateV1 => ({
  version: 1,
  revision: 0,
  learned: [],
  build: { slots: [] },
});
function act(
  state: CultivatorManualStateV1,
  action: 'learn' | 'train' | 'unlock' | 'activate',
  manualId = id,
) {
  return changeManual({
    state,
    action,
    manualId,
    slot: 1,
    realm: '炼气',
    expectedRevision: state.revision,
    resources: { experience: 100000, insight: 100 },
  });
}
function success(result: ReturnType<typeof act>) {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.diagnostics[0].message);
  return result.state;
}
describe('境界功法培养', () => {
  it('四个境界逐一开放，后续境界保持四位', () => {
    expect(
      ['炼气', '筑基', '金丹', '元婴', '化神', '渡劫'].map((r) =>
        getManualSlotCount(r as '炼气'),
      ),
    ).toEqual([1, 2, 3, 4, 4, 4]);
    expect(
      changeManual({
        state: empty(),
        action: 'learn',
        manualId: 'character_manual.houtu',
        slot: 2,
        realm: '炼气',
        expectedRevision: 0,
        resources: { experience: 0, insight: 0 },
      }).ok,
    ).toBe(false);
    expect(act(empty(), 'learn', 'character_manual.houtu').ok).toBe(false);
  });
  it('三本玉简与八次修炼完成九层，瓶颈只解锁不跳层', () => {
    const original = empty();
    let state = success(act(original, 'learn'));
    expect(original).toEqual(empty());
    let jades = 1;
    for (let target = 2; target <= 9; target++) {
      const p = state.learned[0];
      if (p.level === p.unlockedLevel) {
        expect(act(state, 'train').ok).toBe(false);
        const before = p.level;
        state = success(act(state, 'unlock'));
        expect(state.learned[0].level).toBe(before);
        expect(act(state, 'unlock').ok).toBe(false);
        jades++;
      }
      const result = act(state, 'train');
      expect(result.ok && result.cost.experience).toBeGreaterThan(0);
      state = success(result);
      expect(state.learned[0].level).toBe(target);
    }
    expect(jades).toBe(3);
    expect(act(state, 'train').ok).toBe(false);
    expect(act(state, 'unlock').ok).toBe(false);
  });
  it('多个功法独立培养，免费激活保留原有进度', () => {
    let state = success(act(empty(), 'learn'));
    state = success(act(state, 'train'));
    state = success(act(state, 'learn', 'character_manual.qingfeng'));
    state = success(act(state, 'train', 'character_manual.qingfeng'));
    expect(state.build.slots[0].manualId).toBe(id);
    const switched = act(state, 'activate', 'character_manual.qingfeng');
    expect(switched.ok && switched.cost).toEqual({ experience: 0, insight: 0 });
    state = success(switched);
    state = success(act(state, 'activate'));
    expect(state.learned.map((p) => p.level)).toEqual([2, 2]);
    expect(state.build.slots).toEqual([{ slot: 1, manualId: id }]);
    expect(act(state, 'learn').ok).toBe(false);
  });
  it('资源不足或过期操作不修改状态，精确余额可以消费', () => {
    const state = success(act(empty(), 'learn'));
    const base = {
      state,
      action: 'train' as const,
      manualId: id,
      slot: 1 as const,
      realm: '炼气' as const,
      expectedRevision: state.revision,
    };
    expect(
      changeManual({ ...base, resources: { experience: 19, insight: 100 } }).ok,
    ).toBe(false);
    expect(
      changeManual({ ...base, resources: { experience: 20, insight: 1 } }).ok,
    ).toBe(false);
    expect(
      changeManual({
        ...base,
        expectedRevision: 0,
        resources: { experience: 20, insight: 2 },
      }).ok,
    ).toBe(false);
    expect(
      changeManual({ ...base, resources: { experience: 20, insight: 2 } }),
    ).toMatchObject({ ok: true, cost: { experience: 20, insight: 2 } });
    expect(state.learned[0].level).toBe(1);
  });
  it('拒绝伪造层数、提前解锁、重复槽位和未学激活', () => {
    const state = success(act(empty(), 'learn'));
    for (const invalid of [
      { ...state, learned: [{ manualId: id, level: 10, unlockedLevel: 9 }] },
      { ...state, learned: [{ manualId: id, level: 1, unlockedLevel: 9 }] },
      {
        ...state,
        build: { slots: [...state.build.slots, ...state.build.slots] },
      },
      { ...state, learned: [] },
    ])
      expect(validateManualStateV1(invalid, '炼气').length).toBeGreaterThan(0);
  });
  it('双效果从一层生效，未激活功法不贡献，属性只在投影中累加一次', () => {
    let state = success(act(empty(), 'learn', 'character_manual.songhe'));
    state = success(act(state, 'learn'));
    const result = compileCharacterManualsV1({ state, realm: '炼气' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection.attributeBonuses).toEqual({
      vitality: 1,
      willpower: 1,
    });
    expect(result.projection.passiveSkillIds).toHaveLength(1);
    const character = {
      id: 'c',
      name: 'c',
      realm: '炼气' as const,
      realm_stage: '初期' as const,
      attributes: {
        vitality: 10,
        strength: 10,
        spirit: 10,
        endurance: 10,
        speed: 10,
        willpower: 10,
      },
    };
    const derived = withManualAttributes(character, result.projection);
    expect(character.attributes.vitality).toBe(10);
    expect(compileCharacterPanelV1(derived.attributes).maxHp).toBe(488);
    expect(compileCharacterPanelV1(derived.attributes).maxMp).toBe(305);
  });
});
describe('功法数据包', () => {
  it('十六本内容与逐层成本可以加载', () => {
    expect(loadManualPack(MANUAL_PACK).manuals).toHaveLength(16);
  });
  it.each(['duplicate', 'reference', 'attribute', 'cost', 'bottleneck'])(
    '无效配置 %s 在加载时失败',
    (kind) => {
      const pack = structuredClone(MANUAL_PACK);
      if (kind === 'duplicate') pack.manuals.push(pack.manuals[0]);
      if (kind === 'reference') pack.manuals[0].progressionId = 'missing';
      if (kind === 'attribute')
        pack.manuals[0].effects.push(pack.manuals[0].effects[0]);
      if (kind === 'cost') pack.progressions.standard.costsByRealm.炼气.pop();
      if (kind === 'bottleneck')
        pack.progressions.standard.bottlenecks = [6, 3];
      expect(() => loadManualPack(pack)).toThrow();
    },
  );
});
describe('通用能力解析仍独立工作', () => {
  it('stack 累加，highest 取强度更高项，混合策略拒绝', () => {
    const a = {
      capabilityKey: 'x',
      sourceType: 'manual' as const,
      sourceId: 'a',
      stackPolicy: 'stack' as const,
      priority: 0,
      passiveIds: ['a'],
    };
    const b = { ...a, sourceId: 'b', passiveIds: ['b'] };
    expect(resolveCombatCapabilitiesV1([a, b])).toMatchObject({
      ok: true,
      passiveIds: ['a', 'b'],
    });
    expect(
      resolveCombatCapabilitiesV1([
        { ...a, stackPolicy: 'highest', strength: 1 },
        { ...b, stackPolicy: 'highest', strength: 2 },
      ]),
    ).toMatchObject({ ok: true, passiveIds: ['b'] });
    expect(
      resolveCombatCapabilitiesV1([a, { ...b, stackPolicy: 'unique' }]).ok,
    ).toBe(false);
  });
});
