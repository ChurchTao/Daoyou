import { createSectRuntime } from '../core';
import { LINGXIAO_MODULE } from './lingxiao';

/** 生产宗门目录的唯一组合根。测试夹具不得进入这里。 */
export const PRODUCTION_SECT_MODULES = [LINGXIAO_MODULE] as const;
export const PRODUCTION_SECT_IDS = PRODUCTION_SECT_MODULES.map(
  (module) => module.definition.id,
);
export const productionSectRuntime = createSectRuntime(PRODUCTION_SECT_MODULES);
export const sectRegistry = productionSectRuntime.registry;
