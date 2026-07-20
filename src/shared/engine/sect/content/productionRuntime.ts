import {
  createSectRuntime,
  resolveSectPresentation,
  type ResolvedSectPresentation,
  type SectModule,
  type SectPresentationTheme,
} from '../core';
import { LINGXIAO_MODULE, LINGXIAO_SECT_PRESENTATION } from './lingxiao';

export interface ProductionSectEntry {
  module: SectModule;
  presentation?: SectPresentationTheme;
}

export function createProductionSectCatalog(
  entries: readonly ProductionSectEntry[],
): readonly ProductionSectEntry[] {
  const ids = entries.map((entry) => entry.module.definition.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error('生产宗门目录存在重复宗门 ID');
  }
  for (const entry of entries) {
    resolveSectPresentation(entry.module.definition.id, entry.presentation);
  }
  return Object.freeze([...entries]);
}

/** 生产宗门唯一组合根。测试夹具不得进入这里。 */
export const PRODUCTION_SECTS = createProductionSectCatalog([
  {
    module: LINGXIAO_MODULE,
    presentation: LINGXIAO_SECT_PRESENTATION,
  },
]);

export const PRODUCTION_SECT_IDS = PRODUCTION_SECTS.map(
  (entry) => entry.module.definition.id,
);
export const PRODUCTION_SECT_PRESENTATIONS: Readonly<
  Record<string, ResolvedSectPresentation>
> = Object.freeze(
  Object.fromEntries(
    PRODUCTION_SECTS.map((entry) => [
      entry.module.definition.id,
      resolveSectPresentation(entry.module.definition.id, entry.presentation),
    ]),
  ),
);
export const productionSectRuntime = createSectRuntime(
  PRODUCTION_SECTS.map((entry) => entry.module),
);
export const sectRegistry = productionSectRuntime.registry;
