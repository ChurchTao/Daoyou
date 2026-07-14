import { createSectRuntime } from '../core';
import { LINGXIAO_MODULE } from './lingxiao';

/** 生产宗门目录的唯一组合根。测试夹具不得进入这里。 */
export const productionSectRuntime = createSectRuntime([LINGXIAO_MODULE]);
export const sectRegistry = productionSectRuntime.registry;
