import { ActiveSkill } from '../../abilities/ActiveSkill';
import { AbilityId } from '../../core/types';
import { EventBus } from '../../core/EventBus';
import { CooldownModifyEffect } from '../../effects/CooldownModifyEffect';
import { Unit } from '../../units/Unit';

class TestSkill extends ActiveSkill {
  constructor(id: string, name: string) {
    super(id as AbilityId, name, { cooldown: 2 });
  }

  protected executeSkill(): void {}
}

describe('CooldownModifyEffect', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  it('limits modified skills when maxCount is configured', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const sourceSkill = new TestSkill('source', '源术');
    const firstSkill = new TestSkill('first', '一式');
    const secondSkill = new TestSkill('second', '二式');
    const thirdSkill = new TestSkill('third', '三式');

    target.abilities.addAbility(firstSkill);
    target.abilities.addAbility(secondSkill);
    target.abilities.addAbility(thirdSkill);

    new CooldownModifyEffect({ cdModifyValue: 1, maxCount: 1 }).execute({
      caster,
      target,
      ability: sourceSkill,
    });

    expect(firstSkill.currentCooldown).toBe(1);
    expect(secondSkill.currentCooldown).toBe(0);
    expect(thirdSkill.currentCooldown).toBe(0);
  });
});
