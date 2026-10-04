import type { SectDefinition } from '@daoyou/game-domain/sects';
import { JIUJIE_DEFINITION } from './jiujie/definition.js';
import { LINGXIAO_DEFINITION } from './lingxiao/definition.js';
import { TIANYAN_DEFINITION } from './tianyan/definition.js';
import { WUXIANG_DEFINITION } from './wuxiang/definition.js';
import { YOUDU_DEFINITION } from './youdu/definition.js';

/** Identity and version lookup without instantiating gameplay modules. */
export const SECT_ORGANIZATION_DEFINITIONS: Readonly<
  Record<string, SectDefinition>
> = Object.freeze(
  Object.fromEntries(
    [
      LINGXIAO_DEFINITION,
      WUXIANG_DEFINITION,
      TIANYAN_DEFINITION,
      YOUDU_DEFINITION,
      JIUJIE_DEFINITION,
    ].map((definition) => [definition.id, definition]),
  ),
);

export function getSectOrganizationDefinition(sectId: string): SectDefinition {
  if (!Object.hasOwn(SECT_ORGANIZATION_DEFINITIONS, sectId)) {
    throw new Error(`未知宗门: ${sectId}`);
  }
  return SECT_ORGANIZATION_DEFINITIONS[sectId];
}
