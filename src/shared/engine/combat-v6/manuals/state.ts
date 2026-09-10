import type { RealmType } from '@shared/types/constants';
import {
  getManualSlotCount,
  manualSlot,
  validateManualStateV1,
} from './compiler';
import { CHARACTER_MANUALS_V1, manualRule } from './content';
import type {
  CultivatorManualStateV1,
  ManualSlotV1,
  ManualStateChangeResult,
} from './types';

export function changeManual(input: {
  state: CultivatorManualStateV1;
  realm: RealmType;
  expectedRevision: number;
  slot: ManualSlotV1;
  manualId: string;
  action: 'learn' | 'activate' | 'train' | 'unlock';
  resources: { experience: number; insight: number };
}): ManualStateChangeResult {
  const { state, realm, action } = input;
  const fail = (message: string): ManualStateChangeResult => ({
    ok: false,
    diagnostics: [{ severity: 'error', code: 'INVALID_MANUAL_STATE', message }],
  });
  const diagnostics = validateManualStateV1(state, realm);
  if (diagnostics.length) return { ok: false, diagnostics };
  if (state.revision !== input.expectedRevision)
    return fail('功法已变化，请刷新后重试');
  const def = CHARACTER_MANUALS_V1.find((d) => d.id === input.manualId);
  if (
    !def ||
    manualSlot(def) !== input.slot ||
    input.slot > getManualSlotCount(realm)
  )
    return fail('功法不属于已开放的境界位');
  const next = structuredClone(state);
  const learned = next.learned.find((d) => d.manualId === def.id);
  const rule = manualRule(def);
  const cost = { experience: 0, insight: 0 };
  if (action === 'learn') {
    if (learned) return fail('已学会此功法，请修炼或突破瓶颈');
    next.learned.push({
      manualId: def.id,
      level: 1,
      unlockedLevel: rule.bottlenecks[0] ?? rule.maxLevel,
    });
    if (!next.build.slots.some((s) => s.slot === input.slot))
      next.build.slots.push({ slot: input.slot, manualId: def.id });
  } else {
    if (!learned) return fail('尚未学习此功法');
    if (action === 'activate') {
      if (
        next.build.slots.some(
          (s) => s.slot === input.slot && s.manualId === def.id,
        )
      )
        return fail('此功法已激活');
      next.build.slots = next.build.slots.filter((s) => s.slot !== input.slot);
      next.build.slots.push({ slot: input.slot, manualId: def.id });
    } else if (action === 'unlock') {
      if (
        learned.level !== learned.unlockedLevel ||
        learned.level === rule.maxLevel
      )
        return fail('当前未遇到功法瓶颈');
      learned.unlockedLevel =
        rule.bottlenecks.find((n) => n > learned.level) ?? rule.maxLevel;
    } else {
      if (learned.level === rule.maxLevel) return fail('功法已圆满');
      if (learned.level === learned.unlockedLevel)
        return fail('需要同名玉简突破瓶颈');
      Object.assign(cost, rule.costsByRealm[def.realm][learned.level - 1]);
      if (
        !Number.isFinite(input.resources.experience) ||
        !Number.isFinite(input.resources.insight) ||
        input.resources.experience < cost.experience ||
        input.resources.insight < cost.insight
      )
        return fail('修为或道心感悟不足');
      learned.level += 1;
    }
  }
  next.revision += 1;
  next.build.slots.sort((a, b) => a.slot - b.slot);
  return { ok: true, state: next, cost, diagnostics: [] };
}
