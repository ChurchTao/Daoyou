import { AttributeType, ModifierType } from '@/engine/creation-v2/contracts/battle';
import { CREATION_SLUG_CONFIG } from '@/engine/creation-v2/config/CreationSlugConfig';
import { buildAbilitySlug, buildStatBuffId } from '@/engine/creation-v2/services/SlugService';

describe('SlugService', () => {
  it('应为相同输入生成稳定的 ability slug', () => {
    expect(buildAbilitySlug('session-1', 'skill')).toBe(
      `${CREATION_SLUG_CONFIG.abilityPrefix}-skill-session-1`,
    );
    expect(buildAbilitySlug('session-1', 'skill')).toBe(
      `${CREATION_SLUG_CONFIG.abilityPrefix}-skill-session-1`,
    );
  });

  it('应在不同产物类型和 session 间生成唯一的 ability slug', () => {
    const slugs = new Set([
      buildAbilitySlug('session-1', 'skill'),
      buildAbilitySlug('session-1', 'artifact'),
      buildAbilitySlug('session-1', 'gongfa'),
      buildAbilitySlug('session-2', 'skill'),
      buildAbilitySlug('session-2', 'artifact'),
      buildAbilitySlug('session-2', 'gongfa'),
    ]);

    expect(slugs.size).toBe(6);
  });

  it('应为属性 buff id 生成稳定且可区分的 slug', () => {
    expect(buildStatBuffId(AttributeType.SPIRIT, ModifierType.FIXED)).toBe(
      `${CREATION_SLUG_CONFIG.statBuffPrefix}-spirit-fixed`,
    );
    expect(buildStatBuffId(AttributeType.SPIRIT, ModifierType.FIXED)).not.toBe(
      buildStatBuffId(AttributeType.SPIRIT, ModifierType.FINAL),
    );
    expect(buildStatBuffId(AttributeType.SPIRIT, ModifierType.FIXED)).not.toBe(
      buildStatBuffId(AttributeType.WISDOM, ModifierType.FIXED),
    );
  });
});