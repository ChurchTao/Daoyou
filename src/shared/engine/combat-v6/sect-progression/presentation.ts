import { combatV6SkillDetails } from '@shared/combat-v6/skill-details';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  compileSectCombatV6V4,
} from '../content/index';
import type { SectCombatProgressV6 } from '../content/types';

export function sectSkillCatalog(
  progress: SectCombatProgressV6,
  characterLevel: number,
) {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[progress.sectId];
  const path = definition.paths.find((p) => p.id === progress.activePathId)!;
  const compiled = compileSectCombatV6V4({ progress, characterLevel });
  if (!compiled.ok)
    throw new Error(compiled.diagnostics.map((d) => d.message).join('；'));
  const projection = compiled.projection;
  const skills = new Map(
    [...projection.skills, ...projection.skillOverrides].map((skill) => [
      skill.id,
      skill,
    ]),
  );
  const selected = new Set(
    progress.meridianLoadouts.find((l) => l.pathId === path.id)!.nodeIds,
  );
  const authored = [
    ...definition.skills.map((skill) => ({ skill, requirement: '' })),
    ...(path.grantSkills ?? []).map((skill) => ({ skill, requirement: '' })),
    ...(path.foundationPassives ?? []).map((skill) => ({
      skill,
      requirement: '',
    })),
    ...path.nodes.flatMap((node) =>
      [...(node.grantSkills ?? []), ...(node.passives ?? [])].map((skill) => ({
        skill,
        requirement: selected.has(node.id)
          ? ''
          : `需选择第${node.layer}层「${node.name}」`,
      })),
    ),
  ];
  return authored
    .filter(({ skill }) => skill.kind !== 'internal')
    .map(({ skill, requirement }) => {
      const actual = skills.get(skill.definition.id) ?? skill.definition;
      const available =
        projection.activeSkillIds.includes(actual.id) ||
        projection.passiveSkillIds.includes(actual.id);
      const method = definition.methods.find(
        (m) => m.id === skill.sourceMethodId,
      )!;
      return {
        id: actual.id,
        name: actual.name,
        methodId: method.id,
        methodName: method.name,
        level: progress.methods[method.id],
        unlockLevel: skill.unlockMethodLevel,
        available,
        passive: skill.kind === 'passive',
        requirement: available
          ? ''
          : requirement ||
            (progress.methods[method.id] < skill.unlockMethodLevel
              ? `心法${skill.unlockMethodLevel}级解锁`
              : '当前流派或节点替换了此技能'),
        description: combatV6SkillDetails([actual], definition.statuses)[
          actual.id
        ].description,
      };
    });
}

export const SECT_PANEL_LABELS: Record<string, string> = {
  maxHp: '气血上限',
  maxMp: '法力上限',
  physicalAtk: '物理攻击',
  physicalDef: '物理防御',
  magicAtk: '法术攻击',
  magicDef: '法术防御',
  speed: '速度',
  sealHit: '封印命中',
  sealResist: '封印抵抗',
  hit: '命中',
  evasion: '躲避',
  healingPower: '治疗强度',
};
