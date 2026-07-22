import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { StackRule } from '../../buffs/Buff';
import { AttributeType, BuffType, ModifierType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { BuffFactory } from '../../factories/BuffFactory';
import { BattleStateRecorder } from '../../systems/state/BattleStateRecorder';
import { Unit } from '../../units/Unit';

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
                value: {
                  base: 18,
                  attribute: AttributeType.MAGIC_ATK,
                  coefficient: 0,
                },
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
    expect(stateBuff.logVisibility).toBe('player');
    expect(stateBuff.sourceName).toBe('施法者');
  });

  it('records debug visibility for internal buffs', () => {
    const unit = new Unit('unit', '测试者', {});
    unit.buffs.addBuff(
      BuffFactory.create({
        id: 'internal-marker',
        name: '内部标记',
        type: BuffType.BUFF,
        duration: 2,
        stackRule: StackRule.REFRESH_DURATION,
        logVisibility: 'debug',
      }),
    );

    const recorder = new BattleStateRecorder();
    recorder.record('battle_init', 0, [unit]);

    expect(recorder.getFrames()[0].units.unit.buffs[0].logVisibility).toBe(
      'debug',
    );
  });

  it('records status visibility independently from log visibility', () => {
    const unit = new Unit('unit', '测试者', {});
    unit.buffs.addBuff(
      BuffFactory.create({
        id: 'visible-debug-status',
        name: '可见机制状态',
        type: BuffType.BUFF,
        duration: 2,
        stackRule: StackRule.REFRESH_DURATION,
        logVisibility: 'debug',
        statusVisibility: 'player',
      }),
    );

    const recorder = new BattleStateRecorder();
    recorder.record('battle_init', 0, [unit]);

    expect(recorder.getFrames()[0].units.unit.buffs[0]).toMatchObject({
      logVisibility: 'debug',
      statusVisibility: 'player',
    });
  });
});

describe('BattleStateRecorder action states', () => {
  it('records rest and uninterruptible queued action outside the buff list', () => {
    const caster = new Unit('caster', '施法者', {});
    const target = new Unit('target', '目标', {});
    const effect = AbilityFactory.createEffect({
      type: 'queue_action',
      params: {
        id: 'after-strike',
        name: '听雷',
        tags: [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ],
        effects: [{ type: 'damage', params: { value: { base: 10 } } }],
        interruptPolicy: 'uninterruptible',
        hitPolicy: 'guaranteed',
      },
    });
    effect?.execute({
      caster,
      target,
    });

    caster.tags.addTags([GameplayTags.STATUS.CONTROL.STUNNED]);
    const recorder = new BattleStateRecorder();
    recorder.record('battle_init', 0, [caster, target]);
    const snapshot = recorder.getFrames()[0].units.caster;

    expect(snapshot.buffs).toHaveLength(0);
    expect(snapshot.actionStates).toEqual([
      expect.objectContaining({
        type: 'queued_action',
        ability: { id: 'after-strike', name: '听雷' },
        interruptPolicy: 'uninterruptible',
        hitPolicy: 'guaranteed',
      }),
    ]);
    expect(snapshot.canAct).toBe(true);
  });
});
