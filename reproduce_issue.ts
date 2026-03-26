
import { Unit } from './engine/units/Unit';
import { BattleEngineV5 } from './engine/BattleEngineV5';
import { AbilityFactory } from './engine/factories/AbilityFactory';
import { AbilityType, AttributeType, BuffType } from './engine/core/types';
import { BuffConfig } from './engine/core/configs';
import { GameplayTags } from './engine/core';

const createTestUnit = (id: string, name: string, attrs: any = {}) => {
  const unit = new Unit(id as any, name, {
    [AttributeType.SPIRIT]: 100,
    [AttributeType.PHYSIQUE]: 100,
    [AttributeType.AGILITY]: 100,
    [AttributeType.CONSCIOUSNESS]: 100,
    [AttributeType.COMPREHENSION]: 100,
    ...attrs,
  });
  unit.restoreMp(1000);
  return unit;
};

async function main() {
  const player = createTestUnit('player', '法海', {
    [AttributeType.AGILITY]: 1000,
  });
  const opponent = createTestUnit('opponent', '蛇精', {
    [AttributeType.AGILITY]: 0,
  });

  const poisonBuffCfg: BuffConfig = {
    id: 'real_poison',
    name: '万蚁噬心',
    type: BuffType.DEBUFF,
    duration: 3,
    stackRule: 'stack_layer',
    tags: [
      GameplayTags.BUFF.TYPE_DEBUFF,
      GameplayTags.STATUS.POISONED,
      GameplayTags.BUFF.DOT,
    ],
    listeners: [
      {
        eventType: 'ActionPreEvent',
        effects: [{ type: 'damage', params: { value: { base: 100 } } }],
      },
    ],
  };

  player.abilities.addAbility(
    AbilityFactory.create({
      slug: 'cast_poison',
      name: '施毒术',
      type: AbilityType.ACTIVE_SKILL,
      priority: 100,
      effects: [
        { type: 'apply_buff', params: { buffConfig: poisonBuffCfg } },
      ],
    }),
  );

  const engine = new BattleEngineV5(player, opponent);
  (engine as any).executeTurn();

  console.log('--- Battle Logs ---');
  const result = engine.logSystem.formatLogs();
  console.log(result);
}

main().catch(console.error);
