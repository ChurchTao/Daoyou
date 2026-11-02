import {
  MysteryCaseFileSchema,
  MysteryScenarioTemplateSchema,
  type MysteryCaseFile,
  type MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';

import inheritanceMurderTemplate from './data/inheritance_murder.template.json' with { type: 'json' };

import inheritanceMurderFallback from './data/inheritance_murder.fallback.json' with { type: 'json' };

const TEMPLATES: Record<string, MysteryScenarioTemplate> = Object.fromEntries(
  [inheritanceMurderTemplate].map((raw) => {
    const template = MysteryScenarioTemplateSchema.parse(raw);
    return [template.id, template];
  }),
);

/** 每个模板的手写保底案卷：生成失败或校验不通过时使用。 */
const FALLBACK_CASES: Record<string, MysteryCaseFile> = Object.fromEntries(
  [inheritanceMurderFallback].map((raw) => {
    const caseFile = MysteryCaseFileSchema.parse(raw);
    return [caseFile.templateId, caseFile];
  }),
);

/** 手写保底案卷与场景绑定，只入库到与其场景相符的节点。 */
const FALLBACK_NODES: Record<string, readonly string[]> = {
  inheritance_murder: ['SAT_TN_01'],
};

export function listMysteryFallbackSeeds(): Array<{
  templateId: string;
  mapNodeId: string;
}> {
  return Object.entries(FALLBACK_NODES).flatMap(([templateId, nodes]) =>
    FALLBACK_CASES[templateId]
      ? nodes.map((mapNodeId) => ({ templateId, mapNodeId }))
      : [],
  );
}

export function getMysteryTemplate(
  id: string,
): MysteryScenarioTemplate | undefined {
  return TEMPLATES[id];
}

export function listMysteryTemplates(): MysteryScenarioTemplate[] {
  return Object.values(TEMPLATES);
}

export function getMysteryFallbackCase(
  templateId: string,
): MysteryCaseFile | undefined {
  const caseFile = FALLBACK_CASES[templateId];
  return caseFile ? structuredClone(caseFile) : undefined;
}
