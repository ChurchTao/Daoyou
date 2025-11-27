import type { Cultivator, CultivationLevelType } from '../types/cultivator';

/**
 * 根据境界计算基础战力
 * @param cultivationLevel 境界字符串，如 "炼气三层"、"金丹初期"
 * @returns 基础战力值
 */
export function calculateBasePower(cultivationLevel: string): number {
  const level = cultivationLevel.toLowerCase();
  
  // 提取境界类型（炼气、筑基、金丹等）
  let levelType: CultivationLevelType | null = null;
  if (level.includes('炼气')) levelType = '炼气';
  else if (level.includes('筑基')) levelType = '筑基';
  else if (level.includes('金丹')) levelType = '金丹';
  else if (level.includes('元婴')) levelType = '元婴';
  else if (level.includes('化神')) levelType = '化神';
  else if (level.includes('炼虚')) levelType = '炼虚';
  else if (level.includes('合体')) levelType = '合体';
  else if (level.includes('大乘')) levelType = '大乘';
  else if (level.includes('渡劫')) levelType = '渡劫';
  
  // 如果没有匹配到，默认返回炼气期战力
  if (!levelType) {
    return Math.floor(Math.random() * 100) + 1; // 1~100
  }

  // 根据境界类型返回基础战力范围
  switch (levelType) {
    case '炼气':
      return Math.floor(Math.random() * 100) + 1; // 1~100
    case '筑基':
      return Math.floor(Math.random() * 200) + 101; // 101~300
    case '金丹':
      return Math.floor(Math.random() * 300) + 301; // 301~600
    case '元婴':
      return Math.floor(Math.random() * 400) + 601; // 601~1000
    case '化神':
      return Math.floor(Math.random() * 500) + 1001; // 1001~1500
    case '炼虚':
      return Math.floor(Math.random() * 500) + 1501; // 1501~2000
    case '合体':
      return Math.floor(Math.random() * 500) + 2001; // 2001~2500
    case '大乘':
      return Math.floor(Math.random() * 500) + 2501; // 2501~3000
    case '渡劫':
      return Math.floor(Math.random() * 500) + 3001; // 3001~3500
    default:
      return Math.floor(Math.random() * 100) + 1;
  }
}

/**
 * 根据天赋数组计算天赋加成
 * @param talents 天赋数组
 * @returns 天赋加成值（每个天赋 +50~100）
 */
export function calculateTalentBonus(talents: string[]): number {
  if (!talents || talents.length === 0) {
    return 0;
  }
  
  let totalBonus = 0;
  for (const talent of talents) {
    // 每个天赋随机加成 50~100
    totalBonus += Math.floor(Math.random() * 51) + 50;
  }
  
  // 最多加成 300（防止天赋过多导致战力爆炸）
  return Math.min(totalBonus, 300);
}

/**
 * 计算总战力（基础战力 + 天赋加成 + 随机波动）
 * @param basePower 基础战力
 * @param talentBonus 天赋加成
 * @returns 总战力
 */
export function calculateTotalPower(basePower: number, talentBonus: number): number {
  // 随机波动：-50 ~ +50
  const randomVariation = Math.floor(Math.random() * 101) - 50;
  return basePower + talentBonus + randomVariation;
}

/**
 * 计算并设置角色的战力属性
 * @param cultivator 修仙者对象（会修改其战力属性）
 */
export function calculateCultivatorPower(cultivator: Cultivator): void {
  cultivator.basePower = calculateBasePower(cultivator.cultivationLevel);
  cultivator.talentBonus = calculateTalentBonus(cultivator.talents);
  cultivator.totalPower = calculateTotalPower(cultivator.basePower, cultivator.talentBonus);
}

/**
 * 计算"顿悟"机制触发概率
 * @param lowerPower 低战力方的战力
 * @param higherPower 高战力方的战力
 * @returns 触发概率（0~1）
 */
export function calculateMiracleProbability(lowerPower: number, higherPower: number): number {
  if (lowerPower >= higherPower) {
    return 0; // 如果低战力方实际战力更高，不触发
  }
  
  // 公式：(1 - 自己战力/对方战力) * 30%
  const ratio = lowerPower / higherPower;
  return (1 - ratio) * 0.05;
}

/**
 * 判断是否触发"顿悟"机制
 * @param lowerPower 低战力方的战力
 * @param higherPower 高战力方的战力
 * @returns 是否触发
 */
export function checkMiracleTrigger(lowerPower: number, higherPower: number): boolean {
  const probability = calculateMiracleProbability(lowerPower, higherPower);
  return Math.random() < probability;
}

/**
 * 执行战斗（比较战力 + 顿悟机制）
 * @param cultivatorA 修仙者A
 * @param cultivatorB 修仙者B
 * @returns 战斗结果
 */
export function battle(cultivatorA: Cultivator, cultivatorB: Cultivator): {
  winner: Cultivator;
  loser: Cultivator;
  triggeredMiracle: boolean;
} {
  // 确保战力已计算
  if (cultivatorA.totalPower === 0) {
    calculateCultivatorPower(cultivatorA);
  }
  if (cultivatorB.totalPower === 0) {
    calculateCultivatorPower(cultivatorB);
  }

  let winner: Cultivator;
  let loser: Cultivator;
  let triggeredMiracle = false;

  if (cultivatorA.totalPower > cultivatorB.totalPower) {
    winner = cultivatorA;
    loser = cultivatorB;
  } else if (cultivatorB.totalPower > cultivatorA.totalPower) {
    winner = cultivatorB;
    loser = cultivatorA;
  } else {
    // 战力相等，随机决定
    winner = Math.random() > 0.5 ? cultivatorA : cultivatorB;
    loser = winner === cultivatorA ? cultivatorB : cultivatorA;
  }

  // 检查低战力方是否触发"顿悟"
  if (loser.totalPower < winner.totalPower) {
    const miracleTriggered = checkMiracleTrigger(loser.totalPower, winner.totalPower);
    if (miracleTriggered) {
      // 顿悟触发，低战力方获胜
      const temp = winner;
      winner = loser;
      loser = temp;
      triggeredMiracle = true;
    }
  }

  return {
    winner,
    loser,
    triggeredMiracle,
  };
}

