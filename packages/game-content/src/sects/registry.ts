import type { SectDefinitionV6 } from '@daoyou/game-domain/combat';
import { JIUJIE_V6_DEFINITION, validateJiujieContentV1 } from './jiujie.js';
import { LINGXIAO_V6_DEFINITION } from './lingxiao.js';
import { validateSectSkillLearningContent } from './skill-learning.js';
import { TIANYAN_V6_DEFINITION } from './tianyan.js';
import { WUXIANG_V6_DEFINITION } from './wuxiang.js';
import { YOUDU_V6_DEFINITION } from './youdu.js';

/** 当前五宗门内容目录。 */
export const COMBAT_V6_SECT_DEFINITIONS: Record<
  import('@daoyou/game-domain/combat').CombatV6SectId,
  SectDefinitionV6
> = Object.freeze({
  lingxiao: LINGXIAO_V6_DEFINITION,
  youdu: YOUDU_V6_DEFINITION,
  wuxiang: WUXIANG_V6_DEFINITION,
  tianyan: TIANYAN_V6_DEFINITION,
  jiujie: JIUJIE_V6_DEFINITION,
});

function definitionIds(definition: SectDefinitionV6): string[] {
  const authored = [
    ...definition.skills,
    ...definition.paths.flatMap((path) => [
      ...(path.foundationPassives ?? []),
      ...(path.grantSkills ?? []),
      ...path.nodes.flatMap((node) => [
        ...(node.passives ?? []),
        ...(node.grantSkills ?? []),
      ]),
    ]),
  ];
  return [
    definition.id,
    ...definition.methods.map((method) => method.id),
    ...definition.statuses.map((status) => status.id),
    ...definition.paths.map((path) => path.id),
    ...definition.paths.flatMap((path) =>
      (path.resources ?? []).map((resource) => resource.id),
    ),
    ...definition.paths.flatMap((path) => path.nodes.map((node) => node.id)),
    ...authored.map((skill) => skill.definition.id),
    ...authored
      .flatMap((skill) => [
        ...skill.definition.effects,
        ...(skill.definition.successEffects ?? []),
      ])
      .filter((effect) => effect.type === 'emitMechanic')
      .map((effect) =>
        effect.type === 'emitMechanic' ? effect.mechanicId : '',
      ),
  ];
}

export function validateCombatV6SectRegistry(
  registry: Record<string, SectDefinitionV6> = COMBAT_V6_SECT_DEFINITIONS,
): import('@daoyou/game-domain/combat').CombatV6ProjectionDiagnostic[] {
  const diagnostics: import('@daoyou/game-domain/combat').CombatV6ProjectionDiagnostic[] =
    [];
  const owner = new Map<string, string>();
  for (const [key, definition] of Object.entries(registry)) {
    if (definition.id !== key)
      diagnostics.push({
        severity: 'error',
        code: 'SECT_DEFINITION_MISMATCH',
        message: `注册键 ${key} 与宗门定义 ${definition.id} 不一致`,
      });
    for (const id of definitionIds(definition)) {
      const previous = owner.get(id);
      if (previous && previous !== key)
        diagnostics.push({
          severity: 'error',
          code: 'CROSS_SECT_CONTENT_ID_CONFLICT',
          message: `宗门 ${previous} 与 ${key} 的内容 ID 冲突：${id}`,
        });
      else owner.set(id, key);
    }
  }
  return [...diagnostics, ...validateJiujieContentV1()];
}

validateSectSkillLearningContent(Object.values(COMBAT_V6_SECT_DEFINITIONS));
