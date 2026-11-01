import { DEFAULT_AUTO_STRATEGIES } from '@daoyou/game-content/combat/auto-strategies';
import { autoStatusChoices } from '@daoyou/game-content/combat/auto-status-options';
import {
  SECTS_SKILL_LEARNING_DATA,
} from '@daoyou/game-content/authoring/sects';
import {
  WANQIAO_DEFINITION,
  WANQIAO_SECT_PRESENTATION,
} from '@daoyou/game-content/sect-organization/wanqiao';
import { WANQIAO_V6_DEFINITION as definition } from '@daoyou/game-content/sects/wanqiao';
import { describe, expect, it } from 'vitest';
import { resolveSectPresentation } from '../sect-organization/core/presentation/sectPresentation.js';
import { SectDefinitionRule } from '../sect-organization/core/validation/SectDefinitionRule.js';
import { WANQIAO_MODULE } from '../sect-organization/production/wanqiao/index.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

describe('万窍山组织与战斗目录接入', () => {
  it('组织身份与六门心法文案一致，保留标准组织流程', () => {
    expect(() => new SectDefinitionRule().validate(WANQIAO_MODULE)).not.toThrow();
    expect(WANQIAO_DEFINITION.methods.map(({ id, slot, name, description }) => ({
      id, slot, name, description,
    }))).toEqual(definition.methods.map(({ id, slot, name, description }) => ({
      id, slot, name, description,
    })));
    const presentation = resolveSectPresentation('wanqiao', WANQIAO_SECT_PRESENTATION);
    expect(presentation.onboarding?.script.acts.length).toBeGreaterThan(0);
    expect(presentation.map.image).toBeUndefined();
    expect(presentation.rooms.affairs.actors.map(actor => actor.roleKey)).toEqual([
      'daily', 'weekly', 'promotion',
    ]);
  });

  it('组织静听条目不成为战斗技能、学习项或自动行动', () => {
    const placeholder = WANQIAO_DEFINITION.abilities.find(ability => ability.kind === 'default')!;
    expect(placeholder.visibility).toBe('internal');
    expect(Object.hasOwn(SECTS_SKILL_LEARNING_DATA.skills, placeholder.id)).toBe(false);
    for (const path of definition.paths) {
      const progress = createEmptySectCombatProgressV6(
        'wanqiao', path.id,
        Object.fromEntries(definition.methods.map(method => [method.id, 1])),
      );
      const compiled = compileSectDefinitionV6({ definition, progress, characterLevel: 5 });
      expect(compiled.ok).toBe(true);
      if (!compiled.ok) continue;
      expect(compiled.projection.activeSkillIds).toEqual([]);
      expect(compiled.projection.skills.some(skill => skill.id === placeholder.id)).toBe(false);
      expect(DEFAULT_AUTO_STRATEGIES[path.id].rules.some(rule =>
        rule.action.type === 'skill' && rule.action.skillId === placeholder.id,
      )).toBe(false);
    }
  });

  it('两条道途的默认战术与可编辑状态只引用当前战斗内容', () => {
    for (const path of definition.paths) {
      const knownSkillIds = new Set([
        ...definition.skills,
        ...(path.grantSkills ?? []),
        ...path.nodes.flatMap(node => node.grantSkills ?? []),
      ].map(skill => skill.definition.id));
      for (const rule of DEFAULT_AUTO_STRATEGIES[path.id].rules) {
        if (rule.action.type === 'skill') expect(knownSkillIds.has(rule.action.skillId)).toBe(true);
        for (const condition of rule.conditions) {
          if (condition.type === 'selfResourceAtLeast') {
            expect(path.resources?.some(resource => resource.id === condition.resourceId)).toBe(true);
          }
        }
      }
      const choices = autoStatusChoices(path.id);
      for (const choice of [...choices.self, ...choices.target]) {
        expect(definition.statuses.some(status =>
          status.kind === choice.kind && (!choice.statusId || status.id === choice.statusId),
        ), choice.label).toBe(true);
      }
    }
  });
});
