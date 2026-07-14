import { LINGXIAO_MODULE } from './lingxiaoModule';
import { createSectRuntime } from './runtimeFactory';

export const productionSectRuntime = createSectRuntime([LINGXIAO_MODULE]);
export const sectRegistry = productionSectRuntime.registry;
