import { describe, expect, it } from 'vitest';
import {
  createEmptySectCombatProgressV6,
  createFreshCombatV6MethodLevels,
} from '../build-state';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  compileSectCombatV6V4,
} from '../content';
import {
  MERIDIAN_LEVELS,
  meridianUnlockCost,
  methodTrainingCost,
  sectV6Change,
  transferSectProgress,
} from './index';
import { sectSkillCatalog } from './presentation';

const reference = {
  membershipId: '00000000-0000-4000-8000-000000000001',
  expectedRevision: 0,
};
const definitions = Object.values(COMBAT_V6_SECT_DEFINITIONS_V4);
function fresh() {
  const d = definitions[0];
  return createEmptySectCombatProgressV6(
    d.id,
    d.paths[0].id,
    createFreshCombatV6MethodLevels(d.id),
  );
}
describe('v6 sect progression', () => {
  it('uses fixed rounded costs and validates bounds', () => {
    expect(methodTrainingCost(2)).toEqual({
      cultivationExp: 60,
      spiritStones: 200,
      comprehensionInsight: 0,
    });
    expect(
      Array.from(
        { length: 7 },
        (_, i) => meridianUnlockCost(i + 1).cultivationExp,
      ),
    ).toEqual([5000, 20000, 80000, 320000, 1280000, 5120000, 5120000]);
    for (const invalid of [0, 181, 1.5, NaN])
      expect(() => methodTrainingCost(invalid)).toThrow();
    for (const invalid of [0, 8, 1.5])
      expect(() => meridianUnlockCost(invalid)).toThrow();
  });
  it('upgrades exactly once, preserving source and respecting both caps', () => {
    const p = fresh(),
      d = definitions[0];
    const primary = d.methods.find((m) => m.isPrimary)!;
    const branch = d.methods.find((m) => !m.isPrimary)!;
    expect(() =>
      sectV6Change(p, 30, {
        ...reference,
        action: 'train',
        methodId: branch.id,
      }),
    ).toThrow('分支');
    const next = sectV6Change(p, 30, {
      ...reference,
      action: 'train',
      methodId: primary.id,
    }).progress;
    expect(next.methods[primary.id]).toBe(2);
    expect(p.methods[primary.id]).toBe(1);
    expect(
      sectV6Change(next, 30, {
        ...reference,
        action: 'train',
        methodId: branch.id,
      }).progress.methods[branch.id],
    ).toBe(2);
    for (const [level, cap] of [
      [30, 40],
      [180, 180],
    ]) {
      p.methods[primary.id] = cap;
      expect(() =>
        sectV6Change(p, level, {
          ...reference,
          action: 'train',
          methodId: primary.id,
        }),
      ).toThrow('上限');
    }
  });
  it('unlocks sequentially at every character gate without a method gate', () => {
    let p = fresh();
    for (let i = 0; i < 7; i++) {
      expect(() =>
        sectV6Change(p, MERIDIAN_LEVELS[i] - 1, {
          ...reference,
          action: 'unlock',
        }),
      ).toThrow('人物');
      const result = sectV6Change(p, MERIDIAN_LEVELS[i], {
        ...reference,
        action: 'unlock',
      });
      expect(result.progress.meridianDepth).toBe(i + 1);
      expect(result.cost.spiritStones).toBe(result.cost.cultivationExp * 5);
      expect(result.cost.comprehensionInsight).toBe(100);
      p = result.progress;
    }
    expect(() =>
      sectV6Change(p, 180, { ...reference, action: 'unlock' }),
    ).toThrow('全部');
  });
  it('validates inactive drafts and allows empty selections and free switching', () => {
    const p = fresh(),
      path = definitions[0].paths[1];
    const layer = path.nodes.filter((n) => n.layer === 1);
    const save = (nodeIds: string[]) =>
      sectV6Change(p, 180, {
        ...reference,
        action: 'save',
        pathId: path.id,
        nodeIds,
      });
    expect(() => save([layer[0].id])).toThrow('尚未解锁');
    p.meridianDepth = 7;
    expect(() => save([layer[0].id, layer[1].id])).toThrow('每层');
    expect(() => save([layer[0].id, layer[0].id])).toThrow('每层');
    expect(() => save(['foreign'])).toThrow('不属于');
    const cleared = save([]);
    expect(Object.values(cleared.cost)).toEqual([0, 0, 0]);
    const activated = sectV6Change(cleared.progress, 180, {
      ...reference,
      action: 'activate',
      pathId: path.id,
    });
    expect(activated.progress.activePathId).toBe(path.id);
    expect(Object.values(activated.cost)).toEqual([0, 0, 0]);
    expect(
      compileSectCombatV6V4({
        progress: activated.progress,
        characterLevel: 180,
      }).ok,
    ).toBe(true);
  });
  it('maps every sect by method slot, retains shared depth and clears nodes', () => {
    for (const source of definitions)
      for (const target of definitions)
        for (const reverse of [false, true]) {
          const p = createEmptySectCombatProgressV6(
            source.id,
            source.paths[1].id,
            Object.fromEntries(
              source.methods.map((m) => [m.id, m.isPrimary ? 50 : 20 + m.slot]),
            ),
          );
          p.meridianDepth = 6;
          p.meridianLoadouts[0].nodeIds = [source.paths[0].nodes[0].id];
          const next = transferSectProgress(p, target.id, reverse);
          expect(next.meridianDepth).toBe(6);
          expect(next.activePathId).toBe(target.paths[reverse ? 0 : 1].id);
          expect(next.meridianLoadouts.every((l) => !l.nodeIds.length)).toBe(
            true,
          );
          for (const method of target.methods)
            expect(next.methods[method.id]).toBe(
              p.methods[source.methods.find((m) => m.slot === method.slot)!.id],
            );
          expect(
            compileSectCombatV6V4({ progress: next, characterLevel: 180 }).ok,
          ).toBe(true);
        }
  });
  it('renders unique skill entries and descriptions for all sect paths', () => {
    for (const d of definitions)
      for (const path of d.paths) {
        const p = createEmptySectCombatProgressV6(
          d.id,
          path.id,
          Object.fromEntries(d.methods.map((m) => [m.id, 180])),
        );
        const catalog = sectSkillCatalog(p, 180);
        expect(new Set(catalog.map((s) => s.id)).size).toBe(catalog.length);
        expect(catalog.every((s) => s.description.length > 0)).toBe(true);
      }
  });
});
