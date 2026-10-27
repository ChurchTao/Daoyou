import { createBattle } from '@daoyou/combat-core/session';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { DEFAULT_AUTO_STRATEGIES } from '@daoyou/game-content/combat/auto-strategies';
import { BAILU_DEFINITION } from '@daoyou/game-content/sect-organization/bailu';
import {
  BAILU_SKILL_ID,
  BAILU_V6_DEFINITION as definition,
} from '@daoyou/game-content/sects/bailu';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../combat/auto.js';
import { daoyouRulesetV6 } from '../combat/daoyou/index.js';
import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';
import { compileRankingBattle } from '../combat/ranking/battle.js';
import { towerReferenceBuild } from '../tower/reference-fixtures.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';
import { sectSkillCatalog } from './presentation.js';

describe('白鹿传承、人物投影与自动战斗接入', () => {
  it('三列连通路线覆盖42个节点，能力、补丁与末层自动奖励均进入编译结果', () => {
    const covered = new Set<string>();
    for (const path of definition.paths) {
      const fresh = () =>
        createEmptySectCombatProgressV6(
          'bailu',
          path.id,
          Object.fromEntries(
            definition.methods.map((method) => [method.id, 180]),
          ),
        );
      const base = compileSectDefinitionV6({
        definition,
        progress: fresh(),
        characterLevel: 180,
      });
      expect(base.ok).toBe(true);
      if (!base.ok) continue;
      const automatic = path.nodes.filter((node) => node.automatic);
      expect(automatic).toHaveLength(2);
      for (const column of [1, 2, 3]) {
        const route = Array.from({ length: 7 }, (_, index) =>
          path.nodes.find(
            (node) =>
              node.layer === index + 1 &&
              node.slot === (index === 6 ? 2 : column),
          )!,
        );
        const progress = fresh();
        progress.meridianDepth = 7;
        progress.meridianLoadouts.find(
          (loadout) => loadout.pathId === path.id,
        )!.nodeIds = route.map((node) => node.id);
        const compiled = compileSectDefinitionV6({
          definition,
          progress,
          characterLevel: 180,
        });
        expect(compiled.ok, `${path.id}/${column}`).toBe(true);
        if (!compiled.ok) continue;
        const projection = compiled.projection;
        for (const node of [...route, ...automatic]) {
          covered.add(node.id);
          expect(
            (node.passives?.length ?? 0) +
              (node.grantSkills?.length ?? 0) +
              (node.panel?.length ?? 0) +
              (node.patches?.length ?? 0),
            node.id,
          ).toBeGreaterThan(0);
          for (const passive of node.passives ?? [])
            expect(projection.passiveSkillIds).toContain(passive.definition.id);
          for (const skill of node.grantSkills ?? [])
            expect(projection.activeSkillIds).toContain(skill.definition.id);
          for (const panel of node.panel ?? [])
            expect(projection.panel).toContainEqual(panel);
          for (const patch of node.patches ?? []) {
            const actual = projection.skillOverrides.find(
              (skill) => skill.id === patch.skillId,
            );
            expect(actual, node.id).toBeDefined();
            if (patch.operation === 'setCooldownRounds')
              expect(actual!.cooldownRounds).toBe(patch.value);
          }
        }
        const attribute = path.id.endsWith('.edict') ? 'speed' : 'magicAtk';
        const total = (entries: typeof projection.panel) =>
          entries
            .filter((entry) => entry.attr === attribute && entry.mode === 'add')
            .reduce((sum, entry) => sum + entry.value, 0);
        expect(total(projection.panel) - total(base.projection.panel)).toBe(
          attribute === 'speed' ? 60 : 80,
        );
      }
    }
    expect(covered.size).toBe(42);
    expect([...covered].sort()).toEqual(
      definition.paths
        .flatMap((path) => path.nodes.map((node) => node.id))
        .sort(),
    );
  });

  it('组织六心法与战斗传承保持同一身份，不复制组织经脉作为战斗来源', () => {
    expect(
      BAILU_DEFINITION.methods.map(({ id, slot, name }) => ({
        id,
        slot,
        name,
      })),
    ).toEqual(
      definition.methods.map(({ id, slot, name }) => ({ id, slot, name })),
    );
    for (const ability of BAILU_DEFINITION.abilities.filter(
      (ability) => ability.visibility !== 'internal',
    )) {
      expect(
        definition.skills.some(
          (skill) =>
            skill.definition.id === ability.id &&
            skill.definition.name === ability.baseName,
        ),
      ).toBe(true);
    }
  });

  it('技能分别在所属心法门槛解锁，切换流派不携带另一系专属主动', () => {
    for (const path of definition.paths) {
      for (const level of [1, 10, 20, 30, 40, 99, 100, 119, 120, 180]) {
        const progress = createEmptySectCombatProgressV6(
          'bailu',
          path.id,
          Object.fromEntries(
            definition.methods.map((method) => [method.id, level]),
          ),
        );
        const result = compileSectDefinitionV6({
          definition,
          progress,
          characterLevel: 180,
        });
        expect(
          result.ok,
          JSON.stringify(
            result.ok ? result.projection.diagnostics : result.diagnostics,
          ),
        ).toBe(true);
        if (!result.ok) continue;
        const active = result.projection.activeSkillIds;
        expect(active).toContain(BAILU_SKILL_ID.Poxie);
        expect(active).toContain(BAILU_SKILL_ID.Fuyuan);
        expect(active.includes(BAILU_SKILL_ID.Jinfa)).toBe(level >= 40);
        expect(active.includes(BAILU_SKILL_ID.Ningshen)).toBe(level >= 100);
        expect(active.includes(BAILU_SKILL_ID.Hushen)).toBe(level >= 120);
        expect(active.includes(BAILU_SKILL_ID.Pojia)).toBe(
          path.id.endsWith('.edict') && level >= 120,
        );
        expect(active.includes(BAILU_SKILL_ID.Dianming)).toBe(
          path.id.endsWith('.song'),
        );
        expect(active).not.toContain('bailu.passive.righteousness');
        expect(active).not.toContain(BAILU_SKILL_ID.Jinsheng);
        expect(active).not.toContain(BAILU_SKILL_ID.Shesheng);
      }
    }
  });

  it('共享同一被动定义可编译，同ID的不同定义仍会拒绝', () => {
    const conflicting = structuredClone(definition);
    const first = conflicting.paths[0].nodes.find(
      (node) => node.passives?.length,
    )!.passives![0];
    const other = conflicting.paths[1].nodes.find(
      (node) => node.passives?.length,
    )!;
    other.passives = [
      {
        ...structuredClone(first),
        definition: { ...structuredClone(first.definition), name: '不同实现' },
      },
    ];
    const progress = createEmptySectCombatProgressV6(
      'bailu',
      conflicting.paths[0].id,
      Object.fromEntries(conflicting.methods.map((method) => [method.id, 180])),
    );
    const result = compileSectDefinitionV6({
      definition: conflicting,
      progress,
      characterLevel: 180,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'CONTENT_ID_CONFLICT' }),
        ]),
      );
  });

  it('多个经脉授予同一能力时只显示一项，并列出可选择的来源', () => {
    const path = definition.paths[1];
    const progress = createEmptySectCombatProgressV6(
      'bailu',
      path.id,
      Object.fromEntries(definition.methods.map((method) => [method.id, 180])),
    );
    const catalog = sectSkillCatalog(progress, 180);
    const sharedId = 'bailu.passive.lore_revive';
    const granting = path.nodes.filter((node) =>
      node.passives?.some((passive) => passive.definition.id === sharedId),
    );
    expect(granting.length).toBeGreaterThan(1);
    const entry = catalog.filter((skill) => skill.id === sharedId);
    expect(entry).toHaveLength(1);
    expect(entry[0].available).toBe(false);
    for (const node of granting)
      expect(entry[0].requirement).toContain(node.name);
  });

  for (const realm of REALM_VALUES) {
    for (const pathIndex of [0, 1] as const) {
      it(`${realm}/${definition.paths[pathIndex].name} 可由真实养成投影并提交合法自动指令`, () => {
        const player = towerReferenceBuild('bailu', realm, '圆满', pathIndex);
        player.autoStrategy =
          DEFAULT_AUTO_STRATEGIES[definition.paths[pathIndex].id];
        const projected = projectCharacterToCombatV6({
          ...player,
          side: 0,
          slot: 0,
          resourcePolicy: 'full',
        });
        expect(projected.ok, JSON.stringify(projected.diagnostics)).toBe(true);
        if (!projected.ok) return;
        expect(
          projected.diagnostics.filter((item) => item.severity === 'error'),
        ).toEqual([]);
        expect(projected.unit.attrs.hp).toBeGreaterThan(0);
        expect(projected.unit.skills).not.toContain(
          'bailu.passive.righteousness',
        );
        expect(projected.unit.passives).toContain(
          'bailu.passive.righteousness',
        );
        const level = getRealmStageLevel(realm, '圆满');
        expect(
          (projected.unit.skills ?? []).includes(BAILU_SKILL_ID.Hushen),
        ).toBe(level >= 120);

        const opponent = towerReferenceBuild('lingxiao', realm, '圆满');
        opponent.cultivator.id = '00000000-0000-4000-8000-000000000003';
        opponent.beasts = undefined;
        const input = compileRankingBattle([player, opponent], 42);
        const battle = createBattle({ ...input, ruleset: daoyouRulesetV6 });
        const ownerId = player.cultivator.id;
        const choose = () =>
          automaticCommands(
            battle.snapshot(),
            ownerId,
            input.skills ?? [],
            (id) => battle.queryCommands(id),
            { statusDefs: input.statusDefs, strategies: input.autoStrategies },
          );
        const commands = choose();
        expect(choose()).toEqual(commands);
        for (const { unitId, command } of commands) {
          if (command.type === 'skill') {
            expect(battle.unit(unitId).passives).not.toContain(command.skillId);
            expect(
              battle
                .queryCommands(unitId)
                .skills.find((option) => option.skillId === command.skillId)
                ?.ready,
            ).toBe(true);
          }
          expect(() => battle.submit(unitId, command)).not.toThrow();
        }
        battle.submit(opponent.cultivator.id, { type: 'defend' });
        expect(() => battle.lockAndResolve()).not.toThrow();
      });
    }
  }
});
