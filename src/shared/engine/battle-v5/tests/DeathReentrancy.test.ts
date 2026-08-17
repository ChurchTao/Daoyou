import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { BattleRoster } from '../core/BattleRoster';
import { SeededBattleRandomSource } from '../core/BattleRandom';
import { AbilityType, AttributeType, DamageType } from '../core/types';
import { AbilityFactory } from '../factories/AbilityFactory';
import { BattleRuntime } from '../runtime/BattleRuntime';
import { Unit } from '../units/Unit';
import { resolveBattleToCompletion } from '../round/BattleAutoResolver';
import type { CombatFactV3 } from '../v3/types';

function createUnit(
  runtime: BattleRuntime,
  id: string,
  name: string,
  hp: number,
  teamId: string,
): Unit {
  const unit = new Unit(
    id,
    name,
    {
      [AttributeType.VITALITY]: hp,
      [AttributeType.STRENGTH]: 10,
      [AttributeType.SPEED]: 10,
    },
    { runtime, teamId, slot: 0 },
  );
  unit.setHp(hp);
  return unit;
}

function addLethalHit(unit: Unit, baseDamage: number): void {
  unit.abilities.addAbility(
    AbilityFactory.create({
      slug: 'lethal-hit',
      name: '致命一击',
      type: AbilityType.ACTIVE_SKILL,
      priority: 100,
      cooldown: 0,
      targetPolicy: { team: 'enemy', scope: 'single' },
      tags: [
        GameplayTags.ABILITY.KIND.SKILL,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      effects: [
        {
          type: 'damage',
          params: {
            value: { base: baseDamage, coefficient: 0 },
            damageType: DamageType.TRUE,
            canCrit: false,
          },
        },
      ],
    }),
  );
}

// A passive that, inside the same lethal damage window, first prevents death
// and then immediately deals lethal self damage. This mirrors the re-entrant
// damage shape produced by several in-game death-prevent/reflect combinations.
function addDeathPreventThenSelfDamage(unit: Unit): void {
  unit.abilities.addAbility(
    AbilityFactory.create({
      slug: 'death-prevent-self-damage',
      name: '免死后自伤',
      type: AbilityType.PASSIVE_SKILL,
      tags: [
        GameplayTags.ABILITY.FUNCTION.BUFF,
        GameplayTags.ABILITY.FUNCTION.DAMAGE,
        GameplayTags.ABILITY.CHANNEL.TRUE,
      ],
      listeners: [
        {
          eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: 50,
          guard: { requireOwnerAlive: false, allowLethalWindow: true },
          mapping: { caster: 'owner', target: 'owner' },
          effects: [
            {
              type: 'death_prevent',
              params: { hpFloorPercent: 0.3 },
            },
            {
              type: 'damage',
              params: {
                value: { base: 1000, coefficient: 0 },
                damageType: DamageType.TRUE,
                canCrit: false,
                damageSource: 'delayed',
              },
            },
          ],
        },
      ],
    }),
  );
}

describe('unit_died re-entrancy', () => {
  it('commits exactly one unit_died when lethal self damage re-enters the death window', () => {
    const runtime = new BattleRuntime({
      random: new SeededBattleRandomSource('death-reentrancy'),
    });
    const attacker = createUnit(runtime, 'attacker', '攻击者', 500, 'alpha');
    const defender = createUnit(runtime, 'defender', '防守者', 30, 'beta');
    addLethalHit(attacker, 100);
    addDeathPreventThenSelfDamage(defender);

    const result = resolveBattleToCompletion({
      battleId: 'death-reentrancy',
      roster: BattleRoster.fromDuel(attacker, defender),
      runtime,
    });

    const deaths = result.sequences
      .flatMap((sequence) => sequence.facts)
      .filter(
        (fact): fact is Extract<CombatFactV3, { type: 'unit_died' }> =>
          fact.type === 'unit_died',
      );
    const defenderDeaths = deaths.filter(
      (death) => death.target.id === defender.id,
    );
    expect(defenderDeaths).toHaveLength(1);
    runtime.dispose();
  });
});
