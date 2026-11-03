import { DEFAULT_AUTO_STRATEGIES } from '@daoyou/game-content/combat/auto-strategies';
import { XIAOYUE_DEFINITION, XIAOYUE_SECT_PRESENTATION } from '@daoyou/game-content/sect-organization/xiaoyue';
import { XIAOYUE_V6_DEFINITION as definition } from '@daoyou/game-content/sects/xiaoyue';
import { describe, expect, it } from 'vitest';
import { resolveSectPresentation } from '../sect-organization/core/presentation/sectPresentation.js';
import { SectDefinitionRule } from '../sect-organization/core/validation/SectDefinitionRule.js';
import { XIAOYUE_MODULE } from '../sect-organization/production/xiaoyue/index.js';

describe('啸岳岭组织与战斗目录接入', () => {
  it('组织、战斗六心法使用同一身份与学习说明，拜师流程可注册', () => {
    expect(() => new SectDefinitionRule().validate(XIAOYUE_MODULE)).not.toThrow();
    expect(XIAOYUE_DEFINITION.methods.map(({ id, slot, name, description }) => ({
      id, slot, name, description,
    }))).toEqual(definition.methods.map(({ id, slot, name, description }) => ({
      id, slot, name, description,
    })));
    const presentation = resolveSectPresentation('xiaoyue', XIAOYUE_SECT_PRESENTATION);
    expect(presentation.onboarding?.script.acts.length).toBeGreaterThan(0);
    expect(presentation.map.hotspots.every(spot => spot.left !== '0' && spot.top !== '0')).toBe(true);
  });

  it('两条道途的自动战术只引用本人已定义的技能', () => {
    for (const path of definition.paths) {
      const knownSkills = new Set([
        ...definition.skills,
        ...(path.grantSkills ?? []),
        ...path.nodes.flatMap(node => node.grantSkills ?? []),
      ].map(skill => skill.definition.id));
      const strategy = DEFAULT_AUTO_STRATEGIES[path.id];
      expect(strategy.rules.length).toBeGreaterThan(0);
      for (const rule of strategy.rules) {
        if (rule.action.type === 'skill') expect(knownSkills.has(rule.action.skillId)).toBe(true);
      }
    }
  });
});
