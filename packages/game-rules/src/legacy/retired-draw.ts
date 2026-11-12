import { readSpiritGardenSeedSpec } from '@daoyou/game-domain/spirit-field';
import { isSpiritGardenSeed } from '../spirit-field/garden.js';

/** Historical facts remain readable; this guard is only for new production. */
export function isRetiredDrawItem(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const item = value as {
    spec?: { kind?: unknown; scenario?: unknown };
  };
  return (
    item.spec?.kind === 'talisman' &&
    (item.spec.scenario === 'draw_gongfa' ||
      item.spec.scenario === 'draw_skill')
  );
}
export function assertCurrentRewardItem(value: unknown): void {
  if (isRetiredDrawItem(value))
    throw new Error('旧版抽取已停用，不能新增专属符箓');
  if (!value || typeof value !== 'object') return;
  const facts = value as {
    type?: unknown;
    seedSpec?: unknown;
    details?: unknown;
  };
  if (facts.type === 'seed' || 'seedSpec' in facts) {
    const spec = readSpiritGardenSeedSpec(
      'seedSpec' in facts ? facts : facts.details,
    );
    if (!spec || !isSpiritGardenSeed(spec.plant))
      throw new Error('旧版灵种已停止发放，请使用新版灵植目录种子');
  }
}
