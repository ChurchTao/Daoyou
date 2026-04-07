import {
  CREATION_AFFIX_UNLOCK_THRESHOLDS,
  CREATION_LISTENER_PRIORITIES,
  CREATION_RESERVED_ENERGY,
} from '@/engine/creation-v2/config/CreationBalance';
import { CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES } from '@/engine/creation-v2/config/AffixSelectionConstraints';
import { CREATION_EVENT_PRIORITY_LEVELS } from '@/engine/creation-v2/config/CreationEventPriorities';
import { CREATION_SLUG_CONFIG } from '@/engine/creation-v2/config/CreationSlugConfig';

describe('Creation config consistency', () => {
  it('应保证词缀解锁阈值严格递增', () => {
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.prefix).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.suffix,
    );
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.suffix).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.resonance,
    );
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.resonance).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.signature,
    );
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.signature).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.synergy,
    );
    expect(CREATION_AFFIX_UNLOCK_THRESHOLDS.synergy).toBeLessThan(
      CREATION_AFFIX_UNLOCK_THRESHOLDS.mythic,
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
      CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_REQUEST,
    );
    expect(CREATION_LISTENER_PRIORITIES.damageTaken).toBe(
      CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_TAKEN,
    );
  });

  it('应保证 slug 前缀配置非空且彼此区分', () => {
    expect(CREATION_SLUG_CONFIG.abilityPrefix).toBeTruthy();
    expect(CREATION_SLUG_CONFIG.statBuffPrefix).toBeTruthy();
    expect(CREATION_SLUG_CONFIG.abilityPrefix).not.toBe(
      CREATION_SLUG_CONFIG.statBuffPrefix,
    );
  });

  it('应保证所有产品类型都有 affix selection constraint profile', () => {
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.skill).toBeDefined();
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.artifact).toBeDefined();
    expect(CREATION_AFFIX_SELECTION_CONSTRAINT_PROFILES.gongfa).toBeDefined();
  });
});