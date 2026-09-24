import {
  EffectType,
  SkillTag,
  TargetMode,
  TargetSide,
  UnitKind,
} from '../engine/combat-v6/core/enums';
import { createBattle } from '../engine/combat-v6/core/session';
import type { CreateBattleInput } from '../engine/combat-v6/core/types';
import { daoyouRulesetV5 } from '../engine/combat-v6/rules-daoyou';
import { COMBAT_V6_PHASE_7D_VERSIONS } from '../engine/combat-v6/version';

/** Deterministic workloads shared by presentation regression checks and the size benchmark. */
export const presentationScenarios = [
  '1v3',
  '16-attack',
  '16-area',
  '16-status',
] as const;
export function presentationBattle(
  scenario: (typeof presentationScenarios)[number],
) {
  const count = scenario === '1v3' ? 4 : 16;
  const special = scenario === '16-area' || scenario === '16-status';
  const input: CreateBattleInput = {
    seed: 42,
    versions: COMBAT_V6_PHASE_7D_VERSIONS,
    ruleset: daoyouRulesetV5,
    statusDefs: [
      {
        id: 'guard',
        name: '护体',
        kind: 'guard',
        expireSameRound: true,
        attrMods: { physicalDef: 20 },
      },
      {
        id: 'swift',
        name: '疾行',
        kind: 'swift',
        expireSameRound: true,
        attrMods: { speed: 10 },
      },
    ],
    skills: [
      {
        id: 'area',
        name: '横扫',
        tags: [SkillTag.Physical],
        targeting: { side: TargetSide.Enemy, mode: TargetMode.All },
        effects: [
          { type: EffectType.PhysicalHit, power: 50, cannotMiss: true },
        ],
      },
      {
        id: 'ward',
        name: '护阵',
        tags: [SkillTag.Support],
        costMp: 10,
        targeting: { side: TargetSide.Ally, mode: TargetMode.All },
        effects: [
          { type: EffectType.ApplyStatus, statusId: 'guard', duration: 1 },
          { type: EffectType.ApplyStatus, statusId: 'swift', duration: 1 },
          {
            type: EffectType.ApplyBarrier,
            id: 'shield',
            kind: 'shield',
            name: '护盾',
            power: 30,
            duration: 1,
          },
        ],
      },
    ],
    units: Array.from({ length: count }, (_, i) => {
      const side = count === 4 ? (i === 0 ? 0 : 1) : i < 8 ? 0 : 1;
      const slot = count === 4 ? (i === 0 ? 0 : i - 1) : i % 8;
      const pet = count === 16 && slot >= 4;
      return {
        id: `unit-${i}`,
        name: pet ? `灵兽${slot - 3}` : `修士${slot + 1}`,
        side,
        slot,
        kind: pet ? UnitKind.Pet : UnitKind.Player,
        ownerId: pet ? `unit-${i - 4}` : undefined,
        attrs: {
          hp: 5000,
          maxHp: 5000,
          mp: 300,
          maxMp: 300,
          speed: 100 - i,
          physicalAtk: 80,
          physicalDef: 20,
        },
        skills: special ? ['area', 'ward'] : [],
      };
    }),
  };
  const battle = createBattle(input);
  if (special)
    for (const u of input.units)
      battle.submit(u.id!, {
        type: 'skill',
        skillId: scenario === '16-area' ? 'area' : 'ward',
        targets: [],
      });
  return { battle, input };
}
