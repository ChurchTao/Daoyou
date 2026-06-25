import { BuffFactory } from '../../factories/BuffFactory';
import { BattleStateRecorder } from '../../systems/state/BattleStateRecorder';
import { Unit } from '../../units/Unit';
import { AttributeType, BuffType, ModifierType } from '../../core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { StackRule } from '../../buffs/Buff';

describe('BattleStateRecorder buff display', () => {
  it('uses the shared buff text renderer for data-driven buffs without handwritten descriptions', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const buff = BuffFactory.create({
      id: 'legacy_stun_weaken',
      name: '旧式禁制',
      type: BuffType.CONTROL,
      duration: 2,
      stackRule: StackRule.REFRESH_DURATION,
      tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
      modifiers: [
        {
          attrType: AttributeType.DEF,
          type: ModifierType.FIXED,
          value: -12,
        },
      ],
      listeners: [
        {
          eventType: GameplayTags.EVENT.ACTION_PRE,
          scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
          priority: 10,
          effects: [
            {
              type: 'damage',
              params: {
                value: { base: 18, attribute: AttributeType.MAGIC_ATK, coefficient: 0 },
              },
            },
          ],
        },
      ],
    });
    target.buffs.addBuff(buff, caster);

    const recorder = new BattleStateRecorder();
    recorder.record('battle_init', 0, [caster, target]);

    const stateBuff = recorder.getFrames()[0].units.target.buffs[0];
    expect(stateBuff.description).toContain('无法行动');
    expect(stateBuff.description).toContain('物防 -12');
    expect(stateBuff.description).toContain('行动前造成');
    expect(stateBuff.description).not.toMatch(/ActionPreEvent|Status\.|Buff\./);
  });
});
