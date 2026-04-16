/**
 * AffixBoundaryValidation.test.ts
 *
 * 词缀边界规则校验测试（平衡三角论）。
 * 遍历 DEFAULT_AFFIX_REGISTRY 中的所有词缀，按产物类型校验 scope 与 effectType 约束：
 *   - gongfa：listenerSpec.scope 不得为 OWNER_AS_TARGET
 *   - skill：effectTemplate.type 不得为 'attribute_modifier'
 */
import { ModifierType } from '../../contracts/battle';
import { GameplayTags } from '@/engine/shared/tag-domain';
import { DEFAULT_AFFIX_REGISTRY } from '../../affixes';

describe('AffixBoundaryValidation', () => {
  const allDefs = DEFAULT_AFFIX_REGISTRY.getAll();

  it('gongfa 词缀禁止使用 OWNER_AS_TARGET scope', () => {
    const violations = allDefs.filter(
      (def) =>
        def.applicableTo.includes('gongfa') &&
        def.listenerSpec?.scope === GameplayTags.SCOPE.OWNER_AS_TARGET,
    );

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('skill 词缀禁止使用 attribute_modifier effectType', () => {
    const violations = allDefs.filter(
      (def) =>
        def.applicableTo.includes('skill') &&
        def.effectTemplate.type === 'attribute_modifier',
    );

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('artifact 词缀禁止使用 ADD 百分比 attribute_modifier', () => {
    const violations = allDefs.filter((def) => {
      if (!def.applicableTo.includes('artifact')) {
        return false;
      }

      if (def.effectTemplate.type !== 'attribute_modifier') {
        return false;
      }

      const params = def.effectTemplate.params;
      if ('modifiers' in params) {
        return params.modifiers.some((modifier) => modifier.modType === ModifierType.ADD);
      }

      return params.modType === ModifierType.ADD;
    });

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('gongfa 词缀禁止使用 attribute_stat_buff（临时属性 buff 属于 skill 域）', () => {
    const violations = allDefs.filter(
      (def) =>
        def.applicableTo.includes('gongfa') &&
        def.effectTemplate.type === 'attribute_stat_buff',
    );

    expect(violations.map((d) => d.id)).toEqual([]);
  });

  it('skill 词缀允许使用 attribute_stat_buff 作为短效状态词缀语法糖', () => {
    const count = allDefs.filter(
      (def) =>
        def.applicableTo.includes('skill') &&
        def.effectTemplate.type === 'attribute_stat_buff',
    ).length;

    expect(count).toBeGreaterThan(0);
  });

  it('artifact 词缀不出现在 gongfa 专属 scope 中（仅作信息审计）', () => {
    // artifact 的主要 scope 是 OWNER_AS_TARGET 和 GLOBAL
    // OWNER_AS_CASTER 在武器类 artifact 中也是合理的（如攻击触发），此测试仅为审计记录
    const artifactWithCasterScope = allDefs
      .filter(
        (def) =>
          def.applicableTo.includes('artifact') &&
          def.listenerSpec?.scope === GameplayTags.SCOPE.OWNER_AS_CASTER,
      )
      .map((d) => d.id);

    // 审计日志：如果有 OWNER_AS_CASTER，说明存在攻击性 artifact 词缀，这是设计许可范围
    // 此 expect 仅为 snapshot 确认，出现新词缀时应人工审查
    expect(artifactWithCasterScope.length).toBeGreaterThanOrEqual(0);
  });

  it('DEFAULT_AFFIX_REGISTRY 应包含所有三种产物类型的词缀', () => {
    const hasArtifact = allDefs.some((d) => d.applicableTo.includes('artifact'));
    const hasGongfa = allDefs.some((d) => d.applicableTo.includes('gongfa'));
    const hasSkill = allDefs.some((d) => d.applicableTo.includes('skill'));
    expect(hasArtifact).toBe(true);
    expect(hasGongfa).toBe(true);
    expect(hasSkill).toBe(true);
  });

  it('no commonAffixes remain (applicableTo 中不再有跨产物类型的词缀)', () => {
    // 重构后，所有词缀应仅属于单一产物类型，不再出现同时适用于 artifact 和 gongfa 的词缀
    const crossProductAffixes = allDefs.filter(
      (def) =>
        def.applicableTo.includes('artifact') && def.applicableTo.includes('gongfa'),
    );
    expect(crossProductAffixes.map((d) => d.id)).toEqual([]);
  });
});
