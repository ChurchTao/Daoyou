import { describe, expect, it } from 'vitest';
import {
  createEmptySectCombatProgressV6,
  createFreshCombatV6MethodLevels,
} from '../engine/combat-v6/build-state';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../engine/combat-v6/content';
import {
  projectCharacterDisplay,
  type CharacterDisplayBuild,
} from '../lib/cultivatorDisplay';
import { publicCombatV6Build } from './public-build';

describe('public V6 build', () => {
  const character = {
    id: 'public-character',
    name: '道友',
    realm: '炼气' as const,
    realm_stage: '后期' as const,
    attributes: {
      vitality: 20,
      strength: 20,
      spirit: 20,
      endurance: 20,
      speed: 20,
      willpower: 20,
    },
  };
  function build(): CharacterDisplayBuild {
    return {
      sect: createEmptySectCombatProgressV6(
        'lingxiao',
        COMBAT_V6_SECT_DEFINITIONS_V4.lingxiao.paths[0].id,
        createFreshCombatV6MethodLevels('lingxiao'),
      ),
      equipment: {},
      manuals: { version: 1, revision: 7, learned: [], build: { slots: [] } },
    };
  }
  it('matches the character panel and omits private build state', () => {
    const input = build();
    const result = publicCombatV6Build(character, input);
    expect(result.combatPanel).toEqual(
      projectCharacterDisplay(character, input),
    );
    expect(Object.keys(result.build).sort()).toEqual([
      'equipment',
      'manuals',
      'pathName',
      'sectName',
      'skills',
    ]);
    expect(result.build.skills.length).toBeGreaterThan(0);
    expect(
      result.build.skills.every((s) => typeof s.description === 'string'),
    ).toBe(true);
    expect(JSON.stringify(result.build)).not.toContain('meridianLoadouts');
    expect(JSON.stringify(result.build)).not.toContain('revision');
  });
  it('copies equipment and manual slots so later edits cannot change an existing view', () => {
    const input = build();
    const result = publicCombatV6Build(character, input);
    expect(result.build.equipment).not.toBe(input.equipment);
    expect(result.build.manuals).not.toBe(input.manuals.build.slots);
  });
  it('active manual levels affect the full panel while learned alternatives stay private', () => {
    const input = build();
    const baseline = publicCombatV6Build(character, input);
    input.manuals.learned = [
      { manualId: 'character_manual.changchun', level: 3, unlockedLevel: 3 },
      { manualId: 'character_manual.songhe', level: 9, unlockedLevel: 9 },
    ];
    input.manuals.build.slots = [{ slot: 1, manualId: 'character_manual.changchun' }];
    const result = publicCombatV6Build(character, input);
    expect(result.build.manuals).toEqual([{ slot: 1, manualId: 'character_manual.changchun', level: 3 }]);
    expect(JSON.stringify(result.build)).not.toContain('songhe');
    expect(result.combatPanel.maxHp - baseline.combatPanel.maxHp).toBe(24);
    expect(character.attributes.vitality).toBe(20);
  });
});
