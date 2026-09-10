import { describe, expect, it } from 'vitest';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '@shared/engine/combat-v6/content';
import { projectCultivatorMultiSectV5ToCombatV6 } from '@shared/engine/combat-v6/projection';
import { characterResourceMaxima, normalizeCharacterResource, projectCharacterDisplay, type CharacterDisplayBuild, type CultivatorDisplayInput } from './cultivatorDisplay';

const player: CultivatorDisplayInput = {
  id: 'panel-player', name: '面板验收', realm: '炼气', realm_stage: '后期',
  attributes: { vitality: 10, strength: 10, spirit: 10, endurance: 10, speed: 10, willpower: 10 },
  cultivations: [], equipped: { weapon: null, armor: null, accessory: null }, inventory: { artifacts: [] },
};
const definition = COMBAT_V6_SECT_DEFINITIONS_V4.youdu;
const build: CharacterDisplayBuild = {
  sect: {
    version: 1, sectId: 'youdu', methods: Object.fromEntries(definition.methods.map(m => [m.id, 1])),
    activePathId: definition.paths[0].id, meridianDepth: 0,
    meridianLoadouts: definition.paths.map(p => ({ pathId: p.id, nodeIds: [], revision: 0 })) as CharacterDisplayBuild['sect']['meridianLoadouts'],
  },
  equipment: {}, manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
};

describe('V6 character panel authority', () => {
  it('provides the unaffiliated V6 base panel', () => {
    expect(projectCharacterDisplay(player, null)).toEqual({
      physicalAtk: 75, magicAtk: 75, physicalDef: 27, magicDef: 27,
      maxHp: 630, maxMp: 340, speed: 10, hit: 90, dodge: 10,
      healPower: 12, sealHit: 5, sealResist: 5, critRate: 0.05, spellCritRate: 0.05, physicalFuryRate: 0,
    });
  });
  it('matches the battle entry panel with a sect build', () => {
    const battle = projectCultivatorMultiSectV5ToCombatV6({ ...build, cultivator: { ...player, id: player.id! }, side: 0, slot: 0, resourcePolicy: 'full' });
    expect(battle.ok).toBe(true);
    if (!battle.ok) throw new Error('invalid fixture');
    expect(battle.unit.attrs).toMatchObject(projectCharacterDisplay(player, build));
  });
  it('rejects invalid attributes rather than returning a legacy panel', () => {
    expect(() => projectCharacterDisplay({ ...player, attributes: { ...player.attributes, vitality: NaN } }, build)).toThrow();
  });
  it('rejects an invalid sect build rather than returning the base panel', () => {
    expect(() => projectCharacterDisplay(player, { ...build, sect: { ...build.sect, activePathId: 'missing-path' } })).toThrow();
  });
  it('recomputes changed permanent attributes but preserves occupied resource maxima', () => {
    const attrs = projectCharacterDisplay(player, build);
    const input = { ...player, attributes: { ...player.attributes, vitality: 100 }, combatV6ResourceAuthority: { attrs, build, maxHp: attrs.maxHp, maxMp: attrs.maxMp, recoveryPaused: false } };
    expect(characterResourceMaxima(input).maxHp).toBeGreaterThan(attrs.maxHp);
    input.combatV6ResourceAuthority.recoveryPaused = true;
    expect(characterResourceMaxima(input)).toEqual({ maxHp: attrs.maxHp, maxMp: attrs.maxMp });
  });
  it('initializes missing resources, clamps overflow, and never heals on a max increase', () => {
    expect(normalizeCharacterResource(undefined, 630)).toEqual({ current: 630, max: 630 });
    expect(normalizeCharacterResource(630, 900)).toEqual({ current: 630, max: 900 });
    expect(normalizeCharacterResource(900, 630)).toEqual({ current: 630, max: 630 });
  });
});
