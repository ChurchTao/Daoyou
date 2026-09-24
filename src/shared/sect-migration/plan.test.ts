import { describe, expect, it } from 'vitest';
import type { LegacySectMember } from '../contracts/sectMigration';
import { COMBAT_V6_SECT_DEFINITIONS } from '../engine/combat-v6/content';
import mapping from './mapping.json';
import { planLegacySectMigration } from './plan';

function member(
  sectId: keyof typeof mapping = 'lingxiao',
  depths = [4, 2],
): LegacySectMember {
  const rule = mapping[sectId];
  return {
    membershipId: '00000000-0000-4000-8000-000000000001',
    cultivatorId: '00000000-0000-4000-8000-000000000002',
    sectId,
    activePathId: depths[0] ? rule.paths[0][0] : null,
    methods: rule.methods.map(([methodId], i) => ({
      methodId,
      level: 100 - i * 20,
    })),
    paths: rule.paths.map(([pathId], i) => ({
      pathId,
      unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'].slice(
        0,
        depths[i],
      ),
    })),
    meridianLoadouts: [],
  };
}

describe('legacy sect migration', () => {
  it.each(Object.keys(mapping) as (keyof typeof mapping)[])(
    'preserves six slot levels and valid target IDs: %s',
    (sectId) => {
      const source = member(sectId);
      source.methods.reverse();
      const plan = planLegacySectMigration(source);
      const target = COMBAT_V6_SECT_DEFINITIONS[sectId];
      expect(plan.methods.map((m) => m.level)).toEqual([
        100, 80, 60, 40, 20, 0,
      ]);
      expect(plan.methods.map((m) => m.methodId)).toEqual(
        [...target.methods].sort((a, b) => a.slot - b.slot).map((m) => m.id),
      );
      expect(plan.pathIds).toEqual(target.paths.map((p) => p.id));
      expect(plan.meridianDepth).toBe(4);
      expect(plan.refund).toEqual({
        cultivationExp: 25000,
        spiritStones: 125000,
        comprehensionInsight: 200,
      });
    },
  );
  it('refunds one complete path when both are maxed, without granting layer seven', () => {
    const plan = planLegacySectMigration(member('lingxiao', [6, 6]));
    expect(plan.meridianDepth).toBe(6);
    expect(plan.refund).toEqual({
      cultivationExp: 6825000,
      spiritStones: 34125000,
      comprehensionInsight: 600,
    });
  });
  it('preserves the second active path and ignores node selections', () => {
    const source = member('lingxiao', [2, 4]);
    source.activePathId = source.paths[1].pathId;
    source.meridianLoadouts = [
      { pathId: source.activePathId, slot: 1, nodeIds: ['obsolete-node'] },
    ];
    const plan = planLegacySectMigration(source);
    expect(plan.activePathId).toBe(mapping.lingxiao.paths[1][1]);
    expect(plan.meridianDepth).toBe(4);
  });
  it('keeps members without a learned path pending and missing untrained methods at zero', () => {
    const source = member('lingxiao', [0, 0]);
    source.methods = [];
    source.paths = [];
    const plan = planLegacySectMigration(source);
    expect(plan.activePathId).toBeNull();
    expect(plan.methods.every((m) => m.level === 0)).toBe(true);
    expect(plan.refund.cultivationExp).toBe(0);
  });
  it('does not refund a single learned path', () => {
    const plan = planLegacySectMigration(member('lingxiao', [6, 0]));
    expect(plan.refund.spiritStones).toBe(0);
  });
  it('rejects lost primary progress, unknown methods, duplicates and noncontiguous layers', () => {
    const source = member();
    source.methods.shift();
    expect(() => planLegacySectMigration(source)).toThrow('主心法');
    const unknown = member();
    unknown.methods.push({ methodId: 'unknown', level: 1 });
    expect(() => planLegacySectMigration(unknown)).toThrow('未知旧心法');
    const duplicate = member();
    duplicate.methods.push(duplicate.methods[0]);
    expect(() => planLegacySectMigration(duplicate)).toThrow('重复');
    const gap = member();
    gap.paths[0].unlockedLayerIds = ['1', '3'];
    expect(() => planLegacySectMigration(gap)).toThrow('连续');
  });
});
