import type { BuffConfig } from '@shared/engine/battle-v5/core/configs';
import type { SectMethodId } from '../domain';

const SECT_METHOD_GROWTH_KEY = '__sectMethodGrowth';

export interface SectBuffMethodGrowth {
  /** 状态强度改由指定心法结算；缺省时沿用所属神通心法。 */
  methodId?: SectMethodId;
  /** 状态持续时间是否随结算心法成长。 */
  duration?: boolean;
}

type AuthoredSectBuffConfig = BuffConfig & {
  [SECT_METHOD_GROWTH_KEY]?: SectBuffMethodGrowth;
};

/**
 * 为宗门编译期 Buff 附加心法成长声明。
 *
 * 元数据只存在于 authoring/组合阶段，最终投影会将其剥离，battle-v5
 * 始终只接收已经结算完成的 BuffConfig。
 */
export function withSectBuffMethodGrowth(
  config: BuffConfig,
  growth: SectBuffMethodGrowth,
): BuffConfig {
  return {
    ...config,
    [SECT_METHOD_GROWTH_KEY]: growth,
  } as AuthoredSectBuffConfig;
}

export function consumeSectBuffMethodGrowth(config: BuffConfig): {
  config: BuffConfig;
  growth?: SectBuffMethodGrowth;
} {
  const authored = config as AuthoredSectBuffConfig;
  const growth = authored[SECT_METHOD_GROWTH_KEY];
  const runtimeConfig = structuredClone(authored) as AuthoredSectBuffConfig;
  delete runtimeConfig[SECT_METHOD_GROWTH_KEY];
  return { config: runtimeConfig, growth };
}
