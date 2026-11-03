import { WANQIAO_V6_DEFINITION as definition, WANQIAO_PATH_ID, WANQIAO_SKILL_ID } from '@daoyou/game-content/sects/wanqiao';
import type { CharacterCombatInput, MeridianNodeDefV6, SectPathDefV6 } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';
import { towerReferenceBuild } from '../tower/reference-fixtures.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';

function routes(path: SectPathDefV6, selected: MeridianNodeDefV6[] = []): MeridianNodeDefV6[][] {
  const layer = selected.length + 1;
  if (layer === 8) return [selected];
  return path.nodes.filter(node => !node.automatic && node.layer === layer &&
    (!selected.length || Math.abs(node.slot - selected.at(-1)!.slot) <= 1),
  ).flatMap(node => routes(path, [...selected, node]));
}

function input(): CharacterCombatInput {
  const player = towerReferenceBuild('wanqiao', '渡劫', '圆满');
  player.sect.methods = Object.fromEntries(definition.methods.map(method => [method.id, 180]));
  return { ...player, side: 0, slot: 0, resourcePolicy: 'full' };
}

function choose(input: CharacterCombatInput, path: SectPathDefV6, depth: number, slot = 1) {
  input.sect!.activePathId = path.id;
  input.sect!.meridianDepth = depth as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  input.sect!.meridianLoadouts.find(loadout => loadout.pathId === path.id)!.nodeIds =
    Array.from({ length: depth }, (_, i) => path.nodes.find(node => node.layer === i + 1 && !node.automatic && node.slot === (i === 6 ? 2 : slot))!.id);
}

function project(input: CharacterCombatInput) {
  const result = projectCharacterToCombatV6(input);
  expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
  if (!result.ok) throw new Error('投影失败');
  return result;
}

describe('万窍山经脉组合与人物投影', () => {
  it('全部合法连通方案可编译，覆盖42个位置且不泄漏另一道途终极技', () => {
    const covered = new Set<string>();
    for (const path of definition.paths) {
      const alternatives = routes(path);
      expect(alternatives.length).toBeGreaterThan(100);
      for (const route of alternatives) {
        const progress = createEmptySectCombatProgressV6('wanqiao', path.id,
          Object.fromEntries(definition.methods.map(method => [method.id, 180])));
        progress.meridianDepth = 7;
        progress.meridianLoadouts.find(loadout => loadout.pathId === path.id)!.nodeIds = route.map(node => node.id);
        const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
        expect(result.ok, `${path.id}: ${route.map(node => node.id).join(',')} / ${JSON.stringify(result.ok ? [] : result.diagnostics)}`).toBe(true);
        if (!result.ok) continue;
        for (const node of [...route, ...path.nodes.filter(node => node.automatic)]) covered.add(node.id);
        const ownUltimate = path.id === WANQIAO_PATH_ID.Resonance ? WANQIAO_SKILL_ID.Resonate : WANQIAO_SKILL_ID.Coda;
        const otherUltimate = path.id === WANQIAO_PATH_ID.Resonance ? WANQIAO_SKILL_ID.Coda : WANQIAO_SKILL_ID.Resonate;
        expect(result.projection.activeSkillIds).toContain(ownUltimate);
        expect(result.projection.activeSkillIds).not.toContain(otherUltimate);
      }
    }
    expect(covered.size).toBe(42);
  });

  it.each([0, 1] as const)('澄心只增加长生阵纹贡献的70%%，不放大装备基础HP或即时治疗（道途%i）', pathIndex => {
    const build = input();
    build.resourcePolicy = 'persistent';
    build.cultivator.condition!.resources = { hp: { current: 123 }, mp: { current: 45 } };
    build.equipment.armor!.formationInscriptions = [{ patternId: 'dao_inscription.changsheng', level: 2 }, null];
    build.equipment.belt!.formationInscriptions = [{ patternId: 'dao_inscription.changsheng', level: 1 }, null];
    const path = definition.paths[pathIndex];
    choose(build, path, 4);
    const before = project(build);
    choose(build, path, 5);
    const after = project(build);
    expect(after.unit.combatFacts?.changshengMaxHp).toBe(120);
    expect(after.unit.attrs.maxHp! - before.unit.attrs.maxHp!).toBe(84);
    expect(after.unit.attrs.hp).toBe(123);
    expect(after.unit.attrs.mp).toBe(45);
    expect(build.cultivator.condition!.resources.hp!.current).toBe(123);
  });

  it('没有长生阵纹时澄心不放大人物或装备气血', () => {
    const build = input();
    for (const item of Object.values(build.equipment)) item.formationInscriptions = [null, null];
    choose(build, definition.paths[0], 4);
    const before = project(build);
    choose(build, definition.paths[0], 5);
    const after = project(build);
    expect(after.unit.combatFacts?.changshengMaxHp).toBe(0);
    expect(after.unit.attrs.maxHp).toBe(before.unit.attrs.maxHp);
  });

  it('自动留音等级取实际咒术心法，留音尚未解锁时仍保留其等级事实', () => {
    const build = input();
    build.sect!.methods['wanqiao.method.undertone'] = 19;
    choose(build, definition.paths[1], 0);
    const result = project(build);
    expect(result.unit.skills).not.toContain(WANQIAO_SKILL_ID.Echo);
    expect(result.unit.combatFacts?.wanqiao_undertone_level).toBe(19);
  });

  it('木火条件只读武器与衣甲，旧装备无元素时不猜测；投影不改装备事实', () => {
    const build = input();
    build.equipment.weapon!.element = '木';
    build.equipment.armor!.element = '火';
    build.equipment.head!.element = '木';
    build.equipment.belt!.element = '火';
    const before = structuredClone(build.equipment);
    const first = project(build);
    expect(first.unit.combatFacts).toMatchObject({ woodEquipmentCount: 1, fireEquipmentCount: 1 });
    expect(build.equipment).toEqual(before);
    build.equipment.weapon!.generatorVersion = 'dao_equipment_generator_v1';
    delete build.equipment.weapon!.element;
    const old = project(build);
    expect(old.unit.combatFacts).toMatchObject({ woodEquipmentCount: 0, fireEquipmentCount: 1 });
  });

  it.each([0, 1] as const)('内和编译后只允许选自身，入微群法替换不跨道途（道途%i）', pathIndex => {
    const build = input();
    choose(build, definition.paths[pathIndex], 6, 2);
    const projected = project(build);
    const harmony = projected.unit.skillOverrides!.find(skill => skill.id === WANQIAO_SKILL_ID.Harmony)!;
    expect(harmony.targeting.side).toBe('self');
    expect(projected.unit.skills).toContain(pathIndex === 0 ? WANQIAO_SKILL_ID.Chorus : WANQIAO_SKILL_ID.Undertone);
    expect(projected.unit.skills).not.toContain(pathIndex === 0 ? WANQIAO_SKILL_ID.Undertone : WANQIAO_SKILL_ID.Chorus);
  });
});
