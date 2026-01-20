import { FateGenerator } from '@/engine/fate/creation/FateGenerator';
import { FateAffixGenerator } from '@/engine/creation/FateAffixGenerator';
import type { PreHeavenFate } from '@/types/cultivator';
import type { Quality, RealmType } from '@/types/constants';

/**
 * 先天命格生成器（AIGC 架构）
 * @deprecated Use FateGenerator.generate() from @/engine/fate/creation/FateGenerator
 */
export async function generatePreHeavenFates(
  count: number = 10,
  realm: RealmType = '炼气',
): Promise<PreHeavenFate[]> {
  return FateGenerator.generate({ count, realm });
}

/**
 * 直接从蓝图生成命格（用于测试或自定义场景）
 * @deprecated Use FateGenerator internal logic or direct calls to FateAffixGenerator if needed
 */
export function materializeFateFromBlueprint(
  name: string,
  quality: Quality,
  affixIds: string[],
  description: string,
  realm: RealmType = '炼气',
): PreHeavenFate {
  const effects = FateAffixGenerator.generate(quality, realm, affixIds);

  return {
    name,
    quality,
    effects,
    description,
  };
}
