import {
  MysteryCaseFileSchema,
  MysteryScenarioTemplateSchema,
  type MysteryCaseFile,
  type MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';

import inheritanceMurderTemplate from './data/inheritance_murder.template.json' with { type: 'json' };
import lostRelicTemplate from './data/lost_relic.template.json' with { type: 'json' };

import inheritanceMurderFallback from './data/inheritance_murder.fallback.json' with { type: 'json' };
import lostRelicFallback from './data/lost_relic.fallback.json' with { type: 'json' };

const TEMPLATES: Record<string, MysteryScenarioTemplate> = Object.fromEntries(
  [inheritanceMurderTemplate, lostRelicTemplate].map((raw) => {
    const template = MysteryScenarioTemplateSchema.parse(raw);
    return [template.id, template];
  }),
);

/** 每个模板的手写保底案卷：生成失败或校验不通过时使用。 */
const FALLBACK_CASES: Record<string, MysteryCaseFile> = Object.fromEntries(
  [inheritanceMurderFallback, lostRelicFallback].map((raw) => {
    const caseFile = MysteryCaseFileSchema.parse(raw);
    return [caseFile.templateId, caseFile];
  }),
);

/** 手写保底案卷与场景绑定，只入库到与其场景相符的节点。 */
const FALLBACK_NODES: Record<string, readonly string[]> = {
  inheritance_murder: ['SAT_TN_01'],
  lost_relic: ['SAT_LX_02'],
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

/**
 * 模板的手写保底案卷。给出节点时只返回绑定到该节点的保底案卷：
 * 保底案卷的场景是写死的，不能拿到别的节点上用。
 */
export function getMysteryFallbackCase(
  templateId: string,
  mapNodeId?: string,
): MysteryCaseFile | undefined {
  if (mapNodeId && !FALLBACK_NODES[templateId]?.includes(mapNodeId))
    return undefined;
  const caseFile = FALLBACK_CASES[templateId];
  return caseFile ? structuredClone(caseFile) : undefined;
}
