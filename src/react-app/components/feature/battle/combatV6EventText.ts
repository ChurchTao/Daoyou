import type { CombatV6TrainingSessionViewV1 } from '@shared/contracts/combatV6';
import type { BattleEvent } from '@shared/engine/combat-v6/core';
function unitName(units: CombatV6TrainingSessionViewV1['units'], id?: string) {
  return units.find((unit) => unit.id === id)?.name ?? id ?? '未知目标';
}

export function eventText(
  event: BattleEvent,
  units: CombatV6TrainingSessionViewV1['units'],
) {
  switch (event.type) {
    case 'battleStart':
      return '战斗开始。';
    case 'roundStart':
      return `第 ${event.round} 回合开始。`;
    case 'roundEnd':
      return `第 ${event.round} 回合结束。`;
    case 'actionStart':
      return `${unitName(units, event.unitId)}开始行动。`;
    case 'actionSkip':
      return `${unitName(units, event.unitId)}无法行动：${event.reason}`;
    case 'actionFailed':
      return `${unitName(units, event.unitId)}施展失败：${event.reason}`;
    case 'retarget':
      return `${unitName(units, event.unitId)}的目标转向${unitName(units, event.to)}。`;
    case 'miss':
      return `${unitName(units, event.sourceId)}未能命中${unitName(units, event.targetId)}。`;
    case 'damage':
      return `${unitName(units, event.sourceId)}对${unitName(units, event.targetId)}造成 ${event.amount} 点伤害。`;
    case 'heal':
      return `${unitName(units, event.sourceId)}为${unitName(units, event.targetId)}恢复 ${event.amount} 点气血。`;
    case 'mpCost':
      return `${unitName(units, event.unitId)}消耗 ${event.amount} 点法力。`;
    case 'hpCost':
      return `${unitName(units, event.unitId)}消耗 ${event.amount} 点气血。`;
    case 'mpDamage':
      return `${unitName(units, event.targetId)}损失 ${event.amount} 点法力。`;
    case 'mpRestore':
      return `${unitName(units, event.unitId)}恢复 ${event.amount} 点法力。`;
    case 'woundChanged':
      return `${unitName(units, event.targetId)}的伤势由 ${event.before} 变为 ${event.after}。`;
    case 'barrierChanged':
      return `${unitName(units, event.unitId)}的护盾变化：${event.before} → ${event.after}。`;
    case 'statusApplied':
      return `${unitName(units, event.unitId)}获得状态「${event.statusId}」。`;
    case 'statusRemoved':
      return `${unitName(units, event.unitId)}失去状态「${event.statusId}」。`;
    case 'resourceChanged':
      return `${unitName(units, event.unitId)}的${event.resourceId}：${event.before} → ${event.after}。`;
    case 'unitDowned':
      return `${unitName(units, event.unitId)}倒地。`;
    case 'unitDead':
      return `${unitName(units, event.unitId)}战死。`;
    case 'unitRevived':
      return `${unitName(units, event.unitId)}复起，恢复 ${event.hp} 点气血。`;
    case 'unitEscaped':
      return `${unitName(units, event.unitId)}离开了战斗。`;
    case 'mechanicTriggered':
      return `${unitName(units, event.sourceId)}触发「${event.name}」。`;
    case 'chanceResolved':
      return `机缘判定${event.success ? '成功' : '失败'}（${Math.round(event.chance * 100)}%）。`;
    case 'battleEnd':
      return '战斗结束。';
    case 'protectTrigger':
      return `${unitName(units, event.protectorId)}挺身保护${unitName(units, event.originalTargetId)}。`;
    case 'petSummoned':
    case 'petRecalled':
      return `${unitName(units, event.unitId)}的召唤单位发生变化。`;
    default:
      return null;
  }
}
