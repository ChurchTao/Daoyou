import { describe, expect, it } from 'vitest';
import type { Consumable } from '../../types/cultivator';
import { canUseDungeonRecoveryPill, isDungeonRecoveryPill } from './rest';

const pill: Consumable = {
  name: '回灵丹',
  type: '丹药',
  quantity: 1,
  spec: {
    kind: 'pill',
    family: 'mana',
    operations: [
      { type: 'restore_resource', resource: 'mp', mode: 'flat', value: 30 },
    ],
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
    alchemyMeta: {
      source: 'improvised',
      sourceMaterials: [],
      stability: 80,
      toxicityRating: 0,
      tags: [],
    },
  },
};

describe('秘境休整用药边界', () => {
  it('仅探索与休整态允许恢复丹药', () => {
    for (const status of ['EXPLORING', 'LOOTING']) {
      expect(canUseDungeonRecoveryPill({ status }, pill)).toBe(true);
      expect(
        canUseDungeonRecoveryPill({ status, activeBattleId: 'battle' }, pill),
      ).toBe(false);
    }
    for (const status of [
      'WAITING_BATTLE',
      'IN_BATTLE',
      'RECOVERABLE_ERROR',
      'FINISHED',
      'SETTLING',
    ]) {
      expect(canUseDungeonRecoveryPill({ status }, pill)).toBe(false);
    }
  });
  it('恢复附带丹毒允许，夹带成长或状态效果拒绝', () => {
    if (pill.spec.kind !== 'pill') throw new Error('fixture');
    const operations = pill.spec.operations;
    expect(
      isDungeonRecoveryPill({
        spec: {
          ...pill.spec,
          operations: [
            ...operations,
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 5 },
          ],
        },
      }),
    ).toBe(true);
    expect(
      isDungeonRecoveryPill({
        spec: {
          ...pill.spec,
          operations: [
            ...operations,
            {
              type: 'add_status',
              status: 'protect_meridians',
              usesRemaining: 1,
            },
          ],
        },
      }),
    ).toBe(false);
    expect(
      isDungeonRecoveryPill({ spec: { ...pill.spec, operations: [] } }),
    ).toBe(false);
    expect(
      isDungeonRecoveryPill({
        spec: {
          ...pill.spec,
          operations: [
            { type: 'change_gauge', gauge: 'pillToxicity', delta: -5 },
          ],
        },
      }),
    ).toBe(false);
  });
});
