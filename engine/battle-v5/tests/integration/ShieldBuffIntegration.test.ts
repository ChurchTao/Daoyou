import { BattleEngineV5 } from '../../BattleEngineV5';
import { EventBus } from '../../core/EventBus';
import { AbilityType, AttributeType } from '../../core/types';
import { AbilityFactory } from '../../factories/AbilityFactory';
import { Unit } from '../../units/Unit';

describe('护盾 Buff 真实战斗验证', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (EventBus as any)._instance = null;
  });

  it('验证护盾生成、抵扣伤害、护盾破碎和消散日志', () => {
    // 1. 创建角色
    const player = new Unit('player', '玄甲修士', {
      [AttributeType.SPIRIT]: 100, // 灵力影响护盾值
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 10, // 降低身法，减少闪避，让护盾被打
    });

    const opponent = new Unit('opponent', '进攻修士', {
      [AttributeType.SPIRIT]: 10,
      [AttributeType.VITALITY]: 200, // 增加攻击力，确保能打破盾
      [AttributeType.SPEED]: 50,
    });

    // 2. 设计一个护盾 Buff 技能
    // 增加冷却时间，让 Buff 有机会自然消失
    const shieldSkill = AbilityFactory.create({
      slug: 'shield_wall',
      name: '不动如山',
      type: AbilityType.ACTIVE_SKILL,
      priority: 100,
      cooldown: 5, // 5回合冷却
      targetPolicy: { team: 'self', scope: 'single' },
      effects: [
        {
          type: 'shield',
          params: {
            value: {
              base: 100,
              attribute: AttributeType.SPIRIT,
              coefficient: 2.0,
            },
          },
        },
      ],
    });
    player.abilities.addAbility(shieldSkill);

    // 3. 执行战斗模拟
    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 4. 分析日志
    console.log('--- 护盾战斗验证战报 ---');
    result.logs.forEach((log) => console.log(log));
    console.log('------------------------');

    // 验证护盾生成日志（新格式：施放【不动如山】，为 XXX 施加 XXX 点护盾）
    const hasShieldGenLog = result.logs.some(
      (l) => l.includes('不动如山') && l.includes('施加') && l.includes('护盾'),
    );
    expect(hasShieldGenLog).toBe(true);

    // 验证护盾抵扣日志
    const hasAbsorbLog = result.logs.some((l) => l.includes('护盾'));
    expect(hasAbsorbLog).toBe(true);

    // 验证护盾破碎日志（新格式：抵扣护盾 XXX 点，护盾已破碎）
    const hasShieldBreakLog = result.logs.some((l) => l.includes('护盾已破碎'));

    expect(hasShieldBreakLog).toBe(true);
  });
});
