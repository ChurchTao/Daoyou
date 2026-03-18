import { BattleEngineV5 } from '../../BattleEngineV5';
import { CultivatorAdapter } from '../../adapters/CultivatorAdapter';
import { AttributeType } from '../../core/types';
import { FireballSkill } from '../../abilities/examples/FireballSkill';
import { StrengthBuff } from '../../buffs/examples/StrengthBuff';

/**
 * 完整战斗日志测试
 * 输出详细的战斗过程，观察系统运行状态
 */
describe('完整战斗日志测试', () => {
  it('应该输出完整的战斗详细日志', () => {
    // === 创建角色数据 ===
    const playerData = {
      id: 'player_001',
      name: '剑仙李逍遥',
      attributes: {
        spirit: 120,      // 灵力: 法系输出
        vitality: 80,     // 体魄: 生存能力
        speed: 100,       // 身法: 先手优势
        wisdom: 60,       // 悟性: 策略深度
        willpower: 70,    // 神识: 控制能力
      },
    };

    const enemyData = {
      id: 'enemy_001',
      name: '魔尊赵无极',
      attributes: {
        spirit: 100,
        vitality: 100,
        speed: 90,
        wisdom: 50,
        willpower: 60,
      },
    };

    console.log('\n========================================');
    console.log('        战斗开始 - 剑仙 VS 魔尊');
    console.log('========================================\n');

    // === 转换为战斗单元 ===
    const player = CultivatorAdapter.toUnit(playerData);
    const enemy = CultivatorAdapter.toUnit(enemyData);

    // === 添加技能 ===
    const fireball = new FireballSkill();
    fireball.setOwner(player);
    player.abilities.addAbility(fireball);

    const enemyFireball = new FireballSkill();
    enemyFireball.setOwner(enemy);
    enemy.abilities.addAbility(enemyFireball);

    // === 添加 Buff（模拟已有增益） ===
    const strengthBuff = new StrengthBuff();
    player.buffs.addBuff(strengthBuff);

    // === 输出初始状态 ===
    console.log('【初始状态】');
    console.log(`${player.name}:`);
    console.log(`  气血: ${player.currentHp}/${player.maxHp}`);
    console.log(`  真元: ${player.currentMp}/${player.maxMp}`);
    console.log(`  属性: 灵${player.attributes.getValue(AttributeType.SPIRIT)} ` +
                `体${player.attributes.getValue(AttributeType.PHYSIQUE)} ` +
                `敏${player.attributes.getValue(AttributeType.AGILITY)} ` +
                `悟${player.attributes.getValue(AttributeType.COMPREHENSION)} ` +
                `神${player.attributes.getValue(AttributeType.CONSCIOUSNESS)}`);
    console.log(`  技能: ${player.abilities.getAllAbilities().map(a => a.name).join(', ')}`);
    console.log(`  Buff: ${player.buffs.getAllBuffIds().join(', ') || '无'}`);

    console.log(`\n${enemy.name}:`);
    console.log(`  气血: ${enemy.currentHp}/${enemy.maxHp}`);
    console.log(`  真元: ${enemy.currentMp}/${enemy.maxMp}`);
    console.log(`  属性: 灵${enemy.attributes.getValue(AttributeType.SPIRIT)} ` +
                `体${enemy.attributes.getValue(AttributeType.PHYSIQUE)} ` +
                `敏${enemy.attributes.getValue(AttributeType.AGILITY)} ` +
                `悟${enemy.attributes.getValue(AttributeType.COMPREHENSION)} ` +
                `神${enemy.attributes.getValue(AttributeType.CONSCIOUSNESS)}`);
    console.log(`  技能: ${enemy.abilities.getAllAbilities().map(a => a.name).join(', ')}`);
    console.log('');

    // === 执行战斗 ===
    const engine = new BattleEngineV5(player, enemy);
    const result = engine.execute();

    // === 输出战斗结果 ===
    console.log('\n========================================');
    console.log('              战斗结果');
    console.log('========================================');
    console.log(`获胜者: ${result.winner === player.id ? player.name : enemy.name}`);
    console.log(`持续回合: ${result.turns}`);
    console.log('');

    // === 输出战斗日志 ===
    console.log('\n========================================');
    console.log('              详细战报');
    console.log('========================================\n');

    const logs = engine.logSystem.getLogs();
    for (const log of logs) {
      if (log.highlight) {
        console.log(`✨ [第${log.turn}回合] ${log.message}`);
      } else {
        console.log(`   [第${log.turn}回合] ${log.message}`);
      }
    }

    console.log('\n========================================\n');

    // === 验证结果 ===
    expect(result.winner).toBeDefined();
    expect(result.turns).toBeGreaterThan(0);
    expect(result.logs.length).toBeGreaterThan(0);
    expect(logs.length).toBeGreaterThan(0);

    // 验证战斗确实执行了伤害
    const damageLogs = logs.filter(l => l.message.includes('造成') && l.message.includes('伤害'));
    expect(damageLogs.length).toBeGreaterThan(0);

    console.log(`\n统计: 共 ${logs.length} 条日志，其中 ${damageLogs.length} 条伤害记录`);
  });

  it('应该输出极简模式战斗日志', () => {
    const playerData = {
      id: 'player',
      name: '玩家',
      attributes: { spirit: 80, vitality: 60, speed: 50, wisdom: 40, willpower: 30 },
    };
    const opponentData = {
      id: 'opponent',
      name: '对手',
      attributes: { spirit: 70, vitality: 50, speed: 45, wisdom: 35, willpower: 25 },
    };

    const player = CultivatorAdapter.toUnit(playerData);
    const opponent = CultivatorAdapter.toUnit(opponentData);

    // 添加技能
    const fireball = new FireballSkill();
    fireball.setOwner(player);
    player.abilities.addAbility(fireball);

    const engine = new BattleEngineV5(player, opponent);
    engine.logSystem.setSimpleMode(true);

    const result = engine.execute();

    console.log('\n========================================');
    console.log('          极简模式战报');
    console.log('========================================\n');

    const simpleLogs = engine.logSystem.getSimpleLogs();
    for (const log of simpleLogs) {
      console.log(`✨ ${log.message}`);
    }

    console.log('\n========================================\n');

    expect(simpleLogs.length).toBeLessThanOrEqual(result.logs.length);
    expect(simpleLogs.length).toBeGreaterThan(0);
  });
});
