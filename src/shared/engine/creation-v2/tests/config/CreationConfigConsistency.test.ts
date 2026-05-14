import {
  CREATION_AFFIX_UNLOCK_THRESHOLDS,
  CREATION_DURATION_POLICY,
  CREATION_LISTENER_PRIORITIES,
  CREATION_RESERVED_ENERGY,
} from '@shared/engine/creation-v2/config/CreationBalance';
import { resolveAffixSelectionConstraints } from '@shared/engine/creation-v2/config/AffixSelectionConstraints';
import { CREATION_EVENT_PRIORITY_LEVELS } from '@shared/engine/creation-v2/config/CreationEventPriorities';
import { CREATION_SLUG_CONFIG } from '@shared/engine/creation-v2/config/CreationSlugConfig';

describe('Creation config consistency', () => {
  it('应保证词缀解锁阈值严格递增', () => {
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.skill_core).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.skill_variant,
    );
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.skill_variant).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.skill_rare,
    );
  });

  it('应保证保留能量对 skill 高于被动产物', () => {
    expect(CREATION_RESERVED_ENERGY.skill).toBeGreaterThan(
      CREATION_RESERVED_ENERGY.artifact,
    );
    expect(CREATION_RESERVED_ENERGY.artifact).toBe(
      CREATION_RESERVED_ENERGY.gongfa,
    );
  });

  it('应保证 listener 优先级与 creation 事件优先级常量一致', () => {
    expect(CREATION_LISTENER_PRIORITIES.actionPreBuff).toBe(
      CREATION_EVENT_PRIORITY_LEVELS.ACTION_TRIGGER,
    );
    expect(CREATION_LISTENER_PRIORITIES.skillCast).toBe(
      CREATION_EVENT_PRIORITY_LEVELS.SKILL_CAST,
    );
    expect(CREATION_LISTENER_PRIORITIES.damageRequest).toBe(
      CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_REQUEST + 1,
    );
    expect(CREATION_LISTENER_PRIORITIES.damageTaken).toBe(
      CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_TAKEN,
    );
  });

  it('应保证统一 duration policy 满足 control 2-3 / buff-debuff 3-6 的约束', () => {
    expect(CREATION_DURATION_POLICY.control.default).toBe(2);
    expect(CREATION_DURATION_POLICY.control.elite).toBe(3);
    expect(CREATION_DURATION_POLICY.buffDebuff.short).toBe(3);
    expect(CREATION_DURATION_POLICY.buffDebuff.standard).toBe(4);
    expect(CREATION_DURATION_POLICY.buffDebuff.long).toBe(5);
    expect(CREATION_DURATION_POLICY.buffDebuff.extended).toBe(6);
    expect(CREATION_DURATION_POLICY.buffDebuff.persistentException).toBe(-1);
  });

  it('应保证 slug 前缀配置非空且彼此区分', () => {
    expect(CREATION_SLUG_CONFIG.abilityPrefix).toBeTruthy();
    expect(CREATION_SLUG_CONFIG.statBuffPrefix).toBeTruthy();
    expect(CREATION_SLUG_CONFIG.abilityPrefix).not.toBe(
      CREATION_SLUG_CONFIG.statBuffPrefix,
    );
  });

  it('应保证所有产品类型都有 affix selection constraint profile', () => {
    expect(resolveAffixSelectionConstraints('skill', 5, [])).toBeDefined();
    expect(resolveAffixSelectionConstraints('artifact', 5, [])).toBeDefined();
    expect(resolveAffixSelectionConstraints('gongfa', 5, [])).toBeDefined();
  });
});