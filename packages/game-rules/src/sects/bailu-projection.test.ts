import { describe, expect, it } from 'vitest';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { createBattle } from '@daoyou/combat-core/session';
import { BAILU_SKILL_ID, BAILU_V6_DEFINITION as definition } from '@daoyou/game-content/sects/bailu';
import { BAILU_DEFINITION } from '@daoyou/game-content/sect-organization/bailu';
import { DEFAULT_AUTO_STRATEGIES } from '@daoyou/game-content/combat/auto-strategies';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';
import { towerReferenceBuild } from '../tower/reference-fixtures.js';
import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';
import { compileRankingBattle } from '../combat/ranking/battle.js';
import { automaticCommands } from '../combat/auto.js';
import { daoyouRulesetV6 } from '../combat/daoyou/index.js';

describe('白鹿传承、人物投影与自动战斗接入', () => {
  it('组织六心法与战斗传承保持同一身份，不复制组织经脉作为战斗来源', () => {
    expect(BAILU_DEFINITION.methods.map(({ id, slot, name }) => ({ id, slot, name })))
      .toEqual(definition.methods.map(({ id, slot, name }) => ({ id, slot, name })));
    for (const ability of BAILU_DEFINITION.abilities.filter(ability => ability.visibility !== 'internal')) {
      expect(definition.skills.some(skill => skill.definition.id === ability.id && skill.definition.name === ability.baseName))
        .toBe(true);
    }
  });

  it('技能分别在所属心法门槛解锁，切换流派不携带另一系专属主动', () => {
    for (const path of definition.paths) {
      for (const level of [1, 10, 20, 30, 40, 99, 100, 119, 120, 180]) {
        const progress = createEmptySectCombatProgressV6('bailu', path.id,
          Object.fromEntries(definition.methods.map(method => [method.id, level])));
        const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
        expect(result.ok, JSON.stringify(result.diagnostics)).toBe(true);
        if (!result.ok) continue;
        const active = result.projection.activeSkillIds;
        expect(active).toContain(BAILU_SKILL_ID.Poxie);
        expect(active).toContain(BAILU_SKILL_ID.Fuyuan);
        expect(active.includes(BAILU_SKILL_ID.Jinfa)).toBe(level >= 40);
        expect(active.includes(BAILU_SKILL_ID.Ningshen)).toBe(level >= 100);
        expect(active.includes(BAILU_SKILL_ID.Hushen)).toBe(level >= 120);
        expect(active.includes(BAILU_SKILL_ID.Pojia)).toBe(path.id.endsWith('.edict') && level >= 120);
        expect(active.includes(BAILU_SKILL_ID.Dianming)).toBe(path.id.endsWith('.song') && level >= 120);
        expect(active).not.toContain('bailu.passive.righteousness');
        expect(active).not.toContain(BAILU_SKILL_ID.Jinsheng);
        expect(active).not.toContain(BAILU_SKILL_ID.Shesheng);
      }
    }
  });

  for (const realm of REALM_VALUES) {
    for (const pathIndex of [0, 1] as const) {
      it(`${realm}/${definition.paths[pathIndex].name} 可由真实养成投影并提交合法自动指令`, () => {
        const player = towerReferenceBuild('bailu', realm, '圆满', pathIndex);
        player.autoStrategy = DEFAULT_AUTO_STRATEGIES[player.sect.activePathId];
        const projected = projectCharacterToCombatV6({ ...player, side: 0, slot: 0, resourcePolicy: 'full' });
        expect(projected.ok, JSON.stringify(projected.diagnostics)).toBe(true);
        if (!projected.ok) return;
        expect(projected.diagnostics.filter(item => item.severity === 'error')).toEqual([]);
        expect(projected.unit.attrs.hp).toBeGreaterThan(0);
        expect(projected.unit.skills).not.toContain('bailu.passive.righteousness');
        expect(projected.unit.passives).toContain('bailu.passive.righteousness');
        const level = getRealmStageLevel(realm, '圆满');
        expect(projected.unit.skills.includes(BAILU_SKILL_ID.Hushen)).toBe(level >= 120);

        const opponent = towerReferenceBuild('lingxiao', realm, '圆满');
        opponent.cultivator.id = '00000000-0000-4000-8000-000000000003';
        opponent.beasts = undefined;
        const input = compileRankingBattle([player, opponent], 42);
        const battle = createBattle({ ...input, ruleset: daoyouRulesetV6 });
        const ownerId = player.cultivator.id;
        const choose = () => automaticCommands(battle.snapshot(), ownerId, input.skills ?? [],
          id => battle.queryCommands(id), { statusDefs: input.statusDefs, strategies: input.autoStrategies });
        const commands = choose();
        expect(choose()).toEqual(commands);
        for (const { unitId, command } of commands) {
          if (command.type === 'skill') {
            expect(battle.unit(unitId).passives).not.toContain(command.skillId);
            expect(battle.queryCommands(unitId).skills.find(option => option.skillId === command.skillId)?.ready).toBe(true);
          }
          expect(battle.submit(unitId, command)).toEqual({ ok: true });
        }
      });
    }
  }
});
