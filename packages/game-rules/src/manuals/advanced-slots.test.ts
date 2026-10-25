import { describe, expect, it } from 'vitest';
import { CHARACTER_MANUALS_V1, manualRule } from '@daoyou/game-content/manuals';
import type { CultivatorManualStateV1, ManualSlotV1 } from '@daoyou/game-domain/manuals';
import {
  canEquipManualInSlot,
  compileCharacterManualsV1,
  isAdvancedManual,
  manualLearningSlot,
  manualSlot,
  validateManualStateV1,
} from './compiler.js';
import { changeManual } from './state.js';

const advanced = CHARACTER_MANUALS_V1.filter(isAdvancedManual);
const basic = CHARACTER_MANUALS_V1.filter(manual => !isAdvancedManual(manual));
const empty = (): CultivatorManualStateV1 => ({
  version: 1, revision: 0, learned: [], build: { slots: [] },
});
const resources = { experience: 100000000, insight: 200 };
function learnedState(count = 12): CultivatorManualStateV1 {
  return {
    ...empty(),
    learned: advanced.slice(0, count).map((manual, index) => ({
      manualId: manual.id, level: 1, unlockedLevel: 3, slot: index < 6 ? 5 : 6,
    })),
  };
}

describe('六个功法位及独立高阶书目', () => {
  it('任一高阶来源均可选入第五或第六位，基础保留原位', () => {
    expect(basic).toHaveLength(24);
    expect(advanced).toHaveLength(24);
    for (const manual of CHARACTER_MANUALS_V1) {
      const isAdvanced = advanced.includes(manual);
      expect(manualLearningSlot(manual)).toBe(isAdvanced ? 5 : manualSlot(manual));
      for (let slot = 0; slot <= 9; slot++)
        expect(canEquipManualInSlot(manual, slot)).toBe(
          isAdvanced ? slot === 5 || slot === 6 : slot === manualSlot(manual),
        );
    }
    for (const manual of advanced)
      expect(changeManual({
        state: empty(), realm: '大乘', action: 'learn', slot: 5,
        manualId: manual.id, expectedRevision: 0, resources,
      })).toMatchObject({ ok: true, state: { learned: [{ manualId: manual.id, slot: 5 }] } });
    const later = advanced.find((manual) => manual.realm === '炼虚')!;
    const peak = advanced.find((manual) => manual.realm === '大乘')!;
    expect(changeManual({
      state: empty(), realm: '化神', action: 'learn', slot: 5,
      manualId: later.id, expectedRevision: 0, resources,
    }).ok).toBe(false);
    expect(changeManual({
      state: empty(), realm: '炼虚', action: 'learn', slot: 5,
      manualId: later.id, expectedRevision: 0, resources,
    })).toMatchObject({ ok: true });
    expect(changeManual({
      state: empty(), realm: '合体', action: 'learn', slot: 5,
      manualId: peak.id, expectedRevision: 0, resources,
    }).ok).toBe(false);
    expect(changeManual({
      state: empty(), realm: '大乘', action: 'learn', slot: 6,
      manualId: peak.id, expectedRevision: 0, resources,
    })).toMatchObject({ ok: true });
  });

  it('每位最多六本，两高阶位独立计数，满位仍可免费替换', () => {
    let state = empty();
    for (const [index, manual] of advanced.slice(0, 12).entries()) {
      const result = changeManual({
        state, realm: '合体', action: 'learn', slot: index < 6 ? 5 : 6,
        manualId: manual.id, expectedRevision: state.revision, resources,
      });
      expect(result.ok).toBe(true);
      if (result.ok) state = result.state;
    }
    expect(state.learned).toHaveLength(12);
    expect(validateManualStateV1(state, '合体')).toEqual([]);
    for (const slot of [5, 6] as const)
      expect(changeManual({ state, realm: '合体', action: 'learn', slot,
        manualId: advanced[12].id, expectedRevision: 12, resources }).ok).toBe(false);
    expect(changeManual({ state, realm: '合体', action: 'activate', slot: 5,
      manualId: advanced[1].id, expectedRevision: 12, resources })).toMatchObject({
      ok: true, cost: { experience: 0, insight: 0 },
      state: { build: { slots: [{ slot: 5, manualId: advanced[1].id }, { slot: 6, manualId: advanced[6].id }] } },
    });
    const extra = { ...state, learned: [...state.learned, {
      manualId: advanced[12].id, level: 1, unlockedLevel: 3, slot: 5 as const,
    }] };
    expect(validateManualStateV1(extra, '合体')).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: '每个功法位最多学习六种功法' }),
    ]));
    expect(state.revision).toBe(12);
  });

  it('同书不可跨位重复学习，激活与培养只限所属位，非法状态拒绝投影', () => {
    const state = learnedState();
    for (const action of ['learn', 'activate', 'train', 'unlock'] as const)
      expect(changeManual({ state, realm: '大乘', action, slot: 6,
        manualId: advanced[0].id, expectedRevision: 0, resources }).ok).toBe(false);
    for (const slots of [
      [{ slot: 6, manualId: advanced[0].id }],
      [{ slot: 5, manualId: advanced[0].id }, { slot: 6, manualId: advanced[0].id }],
      [{ slot: 4, manualId: advanced[0].id }],
      [{ slot: 5, manualId: basic[0].id }],
      [{ slot: 7, manualId: advanced[0].id }],
    ]) {
      const invalid = { ...state, build: { slots: slots as Array<{ slot: ManualSlotV1; manualId: string }> } };
      expect(compileCharacterManualsV1({ state: invalid, realm: '大乘' }).ok).toBe(false);
    }
    const valid = { ...state, build: { slots: [
      { slot: 5 as const, manualId: advanced[0].id }, { slot: 6 as const, manualId: advanced[6].id },
    ] } };
    const projection = compileCharacterManualsV1({ state: valid, realm: '合体' });
    expect(projection.ok && projection.projection.passiveSkillIds).toHaveLength(2);
  });

  it('第六位在炼虚仍未开放，合体才可学习；已有第六位归属也受开放校验', () => {
    for (const realm of ['化神', '炼虚'] as const) {
      expect(changeManual({ state: empty(), realm, action: 'learn', slot: 6,
        manualId: advanced[0].id, expectedRevision: 0, resources }).ok).toBe(false);
      expect(validateManualStateV1(learnedState(), realm).length).toBeGreaterThan(0);
    }
    expect(changeManual({ state: empty(), realm: '合体', action: 'learn', slot: 6,
      manualId: advanced[0].id, expectedRevision: 0, resources })).toMatchObject({ ok: true });
    expect(changeManual({ state: empty(), realm: '元婴', action: 'learn', slot: 5,
      manualId: advanced[0].id, expectedRevision: 0, resources }).ok).toBe(false);
  });

  it('基础旧记录无需slot，高阶缺归属明确拒绝且保留原始进度', () => {
    const oldBasic = { ...empty(), learned: [{ manualId: basic[0].id, level: 3, unlockedLevel: 6 }] };
    expect(validateManualStateV1(oldBasic, '炼气')).toEqual([]);
    const legacy = { ...empty(), learned: [{ manualId: advanced[0].id, level: 9, unlockedLevel: 9 }] };
    const before = structuredClone(legacy);
    expect(validateManualStateV1(legacy, '大乘')).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: '高阶功法缺少有效归属位，请先迁移旧功法存档，原学习进度已保留' }),
    ]));
    expect(legacy).toEqual(before);
  });

  it('高阶在所属位保留原来源费用和瓶颈，不能借另一位培养', () => {
    const manual = advanced.find(manual => manual.realm === '大乘')!;
    const state: CultivatorManualStateV1 = { ...empty(), learned: [{
      manualId: manual.id, slot: 5, level: 3, unlockedLevel: 3,
    }] };
    const unlocked = changeManual({ state, realm: '大乘', action: 'unlock', slot: 5,
      manualId: manual.id, expectedRevision: 0, resources });
    expect(unlocked.ok && unlocked.state.learned[0].unlockedLevel).toBe(6);
    if (!unlocked.ok) return;
    expect(changeManual({ state: unlocked.state, realm: '大乘', action: 'train', slot: 6,
      manualId: manual.id, expectedRevision: 1, resources }).ok).toBe(false);
    expect(changeManual({ state: unlocked.state, realm: '大乘', action: 'train', slot: 5,
      manualId: manual.id, expectedRevision: 1, resources })).toMatchObject({
      ok: true, cost: manualRule(manual).costsByRealm[manual.realm][2],
      state: { learned: [{ level: 4, slot: 5 }] },
    });
  });
});
