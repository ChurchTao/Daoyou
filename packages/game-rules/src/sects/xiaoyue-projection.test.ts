import { XIAOYUE_V6_DEFINITION as definition, XIAOYUE_SKILL_ID } from '@daoyou/game-content/sects/xiaoyue';
import { describe, expect, it } from 'vitest';
import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';
import { towerReferenceBuild } from '../tower/reference-fixtures.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

describe('啸岳岭经脉与人物投影', () => {
  it('经脉三列路线可编译，终极技只随同契生效', () => {
    const covered = new Set<string>();
    for (const path of definition.paths) {
      for (const column of [1, 2, 3]) {
        const route = Array.from({ length: 7 }, (_, index) =>
          path.nodes.find((node) =>
            node.layer === index + 1 && node.slot === (index === 6 ? 2 : column),
          )!,
        );
        const progress = createEmptySectCombatProgressV6('xiaoyue', path.id,
          Object.fromEntries(definition.methods.map(method => [method.id, 180])));
        progress.meridianDepth = 7;
        progress.meridianLoadouts.find(loadout => loadout.pathId === path.id)!.nodeIds = route.map(node => node.id);
        const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
        expect(result.ok, `${path.id}: ${route.map(node => node.id).join(',')} / ${JSON.stringify(result.ok ? [] : result.diagnostics)}`).toBe(true);
        if (!result.ok) continue;
        for (const node of [...route, ...path.nodes.filter(node => node.automatic)]) covered.add(node.id);
        expect(result.projection.activeSkillIds.includes(XIAOYUE_SKILL_ID.BestPartners))
          .toBe(path.id === 'xiaoyue.path.bond');
      }
    }
    expect(covered).toEqual(new Set(definition.paths.flatMap(
      (path) => path.nodes.map((node) => node.id),
    )));
  });

  it('钢牙只读取武器和衣甲的金元素，旧装备无元素时为零', () => {
    const build = towerReferenceBuild('xiaoyue', '渡劫', '圆满');
    build.equipment.weapon!.element = '金';
    build.equipment.armor!.element = '金';
    build.equipment.head!.element = '金';
    const original = structuredClone(build.equipment);
    const both = projectCharacterToCombatV6({ ...build, side: 0, slot: 0, resourcePolicy: 'full' });
    expect(both.ok).toBe(true);
    if (!both.ok) return;
    expect(both.unit.combatFacts?.metalEquipmentCount).toBe(2);
    expect(build.equipment).toEqual(original);

    delete build.equipment.weapon!.element;
    delete build.equipment.armor!.element;
    const none = projectCharacterToCombatV6({ ...build, side: 0, slot: 0, resourcePolicy: 'full' });
    expect(none.ok).toBe(true);
    if (none.ok) expect(none.unit.combatFacts?.metalEquipmentCount).toBe(0);
  });
});
