import { isTalismanScenario } from '@daoyou/game-domain/consumables';
import { seedFactsOf } from '@daoyou/game-domain/inventory';
import { describe, expect, it } from 'vitest';
import { ItemGrantSchema } from '../inventory/index.js';
import { RewardItemSchema } from '../rewards/items.js';
import { buildSpiritGardenSeed } from '../spirit-field/garden.js';
import { assertCurrentRewardItem, isRetiredDrawItem } from './retired-draw.js';
import { legacySeedMaterial } from './seed-fixtures.js';

describe('retired draw production boundary', () => {
  it('rejects retired draw talismans without changing facts', () => {
    for (const value of [
      { spec: { kind: 'talisman', scenario: 'draw_gongfa' } },
      { spec: { kind: 'talisman', scenario: 'draw_skill' } },
    ]) {
      const before = structuredClone(value);
      expect(isRetiredDrawItem(value)).toBe(true);
      expect(() => assertCurrentRewardItem(value)).toThrow('旧版抽取已停用');
      expect(value).toEqual(before);
    }
    expect(isTalismanScenario('draw_gongfa')).toBe(false);
    expect(isTalismanScenario('draw_skill')).toBe(false);
  });
  it('preserves ordinary materials and active talismans', () => {
    for (const value of [
      null,
      { type: 'ore' },
      { type: 'gongfa_manual' },
      { type: 'skill_manual' },
      { spec: { kind: 'talisman', scenario: 'friend_mail_send' } },
    ]) {
      expect(() => assertCurrentRewardItem(value)).not.toThrow();
    }
  });
  it('allows catalog seeds and rejects old seed production while preserving original facts', () => {
    const seed = buildSpiritGardenSeed('licorice', '凡品');
    const oldSeed = legacySeedMaterial();
    for (const value of [seed, seedFactsOf(seed)])
      expect(() => assertCurrentRewardItem(value)).not.toThrow();
    for (const value of [oldSeed, seedFactsOf(oldSeed), { type: 'seed' }]) {
      const before = structuredClone(value);
      expect(() => assertCurrentRewardItem(value)).toThrow(
        '旧版灵种已停止发放',
      );
      expect(value).toEqual(before);
    }
    const legacyGrant = {
      definitionId: 'seed.v1',
      quantity: 1,
      instanceData: seedFactsOf(oldSeed),
    };
    expect(ItemGrantSchema.safeParse(legacyGrant).success).toBe(true);
    expect(RewardItemSchema.safeParse(legacyGrant).success).toBe(false);
    expect(
      RewardItemSchema.safeParse({
        ...legacyGrant,
        instanceData: seedFactsOf(seed),
      }).success,
    ).toBe(true);
  });
});
