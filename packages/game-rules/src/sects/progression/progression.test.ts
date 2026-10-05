import { describe, expect, it } from 'vitest';
import {
  createEmptySectCombatProgressV6,
  createFreshCombatV6MethodLevels,
} from '../build-state.js';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { compileCurrentSectCombatV6 } from '../index.js';
import {
  MERIDIAN_LEVELS,
  meridianUnlockCost,
  methodTrainingCost,
  sectV6Change,
  transferSectProgress,
} from '../progression.js';
import { sectSkillCatalog } from '../presentation.js';

const reference = {
  membershipId: '00000000-0000-4000-8000-000000000001',
  expectedRevision: 0,
};
const definitions = Object.values(COMBAT_V6_SECT_DEFINITIONS);
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
  it('trains shared methods before selecting a path without assigning one', () => {
    for (const definition of definitions) {
      const p = createEmptySectCombatProgressV6(
        definition.id,
        definition.paths[0].id,
        createFreshCombatV6MethodLevels(definition.id),
      );
      p.activePathId = '';
      const primary = definition.methods.find((method) => method.isPrimary)!;
      const branch = definition.methods.find((method) => !method.isPrimary)!;
      const trained = sectV6Change(p, 10, {
        ...reference,
        action: 'train',
        methodId: primary.id,
        targetLevel: 2,
      });
      expect(trained.progress.activePathId).toBe('');
      expect(trained.progress.methods[primary.id]).toBe(2);
      expect(trained.cost).toEqual(methodTrainingCost(2));
      expect(p.methods[primary.id]).toBe(1);
      expect(trained.progress.meridianLoadouts).toEqual(p.meridianLoadouts);
      expect(
        sectV6Change(trained.progress, 10, {
          ...reference,
          action: 'train',
          methodId: branch.id,
        }).progress.methods[branch.id],
      ).toBe(2);
      expect(() =>
        sectV6Change(p, 10, {
          ...reference,
          action: 'train',
          methodId: branch.id,
        }),
      ).toThrow('分支');
      expect(
        compileCurrentSectCombatV6({
          progress: trained.progress,
          characterLevel: 10,
        }).ok,
      ).toBe(true);
    }
  });
  it('requires initial path selection before editing meridians or switching paths', () => {
    const p = fresh();
    p.activePathId = '';
    const pathId = definitions[0].paths[0].id;
    expect(() =>
      sectV6Change(p, 180, { ...reference, action: 'unlock' }),
    ).toThrow('先选择流派');
    expect(() =>
      sectV6Change(p, 180, { ...reference, action: 'activate', pathId }),
    ).toThrow('先选择流派');
    expect(() =>
      sectV6Change(p, 180, {
        ...reference,
        action: 'save',
        pathId,
        nodeIds: [],
      }),
    ).toThrow('先选择流派');
  });
  it('trains to a target level with the sum of each level cost', () => {
    const p = fresh();
    const primary = definitions[0].methods.find((m) => m.isPrimary)!;
    const result = sectV6Change(p, 30, {
      ...reference,
      action: 'train',
      methodId: primary.id,
      targetLevel: 4,
    });
    expect(result.progress.methods[primary.id]).toBe(4);
    expect(p.methods[primary.id]).toBe(1);
    expect(result.cost).toEqual(
      [2, 3, 4].map(methodTrainingCost).reduce(
        (total, step) => ({
          cultivationExp: total.cultivationExp + step.cultivationExp,
          spiritStones: total.spiritStones + step.spiritStones,
          comprehensionInsight: total.comprehensionInsight + step.comprehensionInsight,
        }),
        { cultivationExp: 0, spiritStones: 0, comprehensionInsight: 0 },
      ),
    );
    expect(() => sectV6Change(p, 30, { ...reference, action: 'train', methodId: primary.id, targetLevel: 1 })).toThrow('高于');
    expect(() => sectV6Change(p, 30, { ...reference, action: 'train', methodId: primary.id, targetLevel: 41 })).toThrow('上限');
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
      compileCurrentSectCombatV6({
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
            compileCurrentSectCombatV6({ progress: next, characterLevel: 180 }).ok,
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
