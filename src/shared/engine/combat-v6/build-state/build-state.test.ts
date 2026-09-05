import { COMBAT_V6_SECT_DEFINITIONS_V4, type CombatV6SectId } from '../content';
import {
  COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1,
  createCombatV6BuildView,
  createEmptySectCombatProgressV6,
  createFreshCombatV6MethodLevels,
  normalizeCombatV6MigratedMethodLevels,
} from './index';

describe('combat-v6 Phase 7B build state', () => {
  test('defines six unique slot mappings for every sect', () => {
    for (const sectId of Object.keys(COMBAT_V6_SECT_DEFINITIONS_V4) as CombatV6SectId[]) {
      const legacyIds = COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1[sectId];
      expect(legacyIds).toHaveLength(6);
      expect(new Set(legacyIds).size).toBe(6);
      expect(COMBAT_V6_SECT_DEFINITIONS_V4[sectId].methods.map((method) => method.slot).sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  test('clamps migrated levels to character and primary method caps', () => {
    const ids = COMBAT_V6_LEGACY_METHOD_IDS_BY_SLOT_V1.lingxiao;
    const levels = normalizeCombatV6MigratedMethodLevels(
      'lingxiao',
      { [ids[0]]: 30, [ids[1]]: 50, [ids[2]]: -1, [ids[3]]: 200 },
      25,
    );
    const methods = COMBAT_V6_SECT_DEFINITIONS_V4.lingxiao.methods.slice().sort((a, b) => a.slot - b.slot);
    expect(methods.map((method) => levels[method.id])).toEqual([30, 30, 0, 30, 0, 0]);
  });

  test('creates a fresh level-one, empty two-path build without mutating levels', () => {
    const levels = createFreshCombatV6MethodLevels('youdu');
    const before = structuredClone(levels);
    const pathId = COMBAT_V6_SECT_DEFINITIONS_V4.youdu.paths[1].id;
    const progress = createEmptySectCombatProgressV6('youdu', pathId, levels);
    expect(progress.activePathId).toBe(pathId);
    expect(progress.meridianDepth).toBe(0);
    expect(progress.meridianLoadouts).toHaveLength(2);
    expect(progress.meridianLoadouts.every((loadout) => loadout.nodeIds.length === 0)).toBe(true);
    expect(levels).toEqual(before);
  });

  test('build views are immutable copies for all initialization states', () => {
    expect(createCombatV6BuildView({ status: 'uninitialized' })).toMatchObject({
      status: 'uninitialized',
      methods: [],
      paths: [],
    });
    const levels = createFreshCombatV6MethodLevels('wuxiang');
    const view = createCombatV6BuildView({ status: 'pending', sectId: 'wuxiang', methodLevels: levels });
    levels[Object.keys(levels)[0]] = 99;
    expect(view.methods.every((method) => method.level === 1)).toBe(true);
  });
});
