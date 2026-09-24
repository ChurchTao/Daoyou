import { ATTR_NAMES, createUnit, evalExpr } from '../core';
import { ExprFn, ExprVar } from '../core/enums';

const formulaFields = new Set(['barrierDamageBonus', 'healingPerRound', 'sealChanceFactor', 'allDamageTakenBonus', 'hitAdd', 'expression', 'requirement', 'extraCount', 'extraChance', 'hpRatio', 'hpCap', 'mpCap', 'costMp', 'costHp', 'targetCount', 'count', 'power', 'duration', 'speedMod', 'value', 'factor', 'maxGainPerAction', 'followPower', 'healingPower', 'sealChanceAdd', 'damageTakenAdd', 'damageTakenBonus', 'physicalFuryChanceAdd', 'sealResistanceAdd', 'damageBonus', 'damageAdd', 'physicalAttackAdd', 'critChanceAdd', 'critMultiplierAdd', 'defenseIgnoreAdd', 'protectedDamageBonus', 'recoverySkipChance', 'targetCountAdd', 'chance', 'amount', 'aimCount']);
const allowedVariables = new Set<string>([
  ...ATTR_NAMES, ...Object.values(ExprVar), ...Object.values(ExprFn),
  ...ATTR_NAMES.flatMap(attr => ['source.' + attr, 'target.' + attr]), 'enemyCount', 'source.level', 'target.level', 'originalResourceCost', 'round', 'roundHpDamage', 'enemyDownedPlayers', 'allyDownedPlayers', 'allyMaxMagicAtk', 'actionKillsTarget', 'targetDeployedPets', 'enemyPlayers', 'targetIsPet', 'normalTarget',
]);
const expressionUnit = createUnit({ id: 'config-validation', name: '配置校验', kind: 'npc', side: 0, slot: 0, level: 180, attrs: { hp: 1000, maxHp: 1000, speed: 10, physicalAtk: 10, physicalDef: 10 } }, 0);
export function validateSectExpressions(pack: unknown, issue: (path: (string | number)[], message: string) => void) {
function walk(value: unknown, path: (string | number)[], formula = false) {
  if (typeof value === 'string' && formula) {
    try {
      for (const name of value.match(/[A-Za-z_][A-Za-z0-9_.]*/g) ?? [])
        if (!allowedVariables.has(name) && !/^(known\.tianyan\.(skill|passive)\.[a-z0-9_.]+|hasStatus\.tianyan\.status\.[a-z0-9_.]+)$/.test(name) && !/^(known\.jiujie\.(skill|passive)\.[a-z0-9_.]+|resource\.jiujie\.resource\.[a-z_]+|fact\.(jiujie_[a-z0-9_]+|spiritPoints|lingyaoMagicAtk|metalWindThunderEquipmentCount|thunderMethodLevel)|(?:statusRounds|targetStatusRounds|ownedTargetStatus|enemyStatus)\.jiujie\.[a-z0-9_.]+|effective\.[a-zA-Z]+|targetEffective\.[a-zA-Z]+)$/.test(name) && !/^((?:known|targetKnown)\.wuxiang\.(skill|passive)\.[a-z0-9_.]+|resource\.wuxiang\.resource\.[a-z_]+|fact\.(wuxiang_[a-z0-9_]+|beltMaxHp|beltPhysicalDef)|(?:statusRounds|targetStatusRounds|ownedTargetStatus)\.(?:wuxiang|youdu)\.[a-z0-9_.]+|effective\.(?:healPower|physicalAtk|physicalDef)|allyTagCount\.[a-z_.]+)$/.test(name) && !/^(enemyStatus|allyStatus)\.youdu\.[a-z_]+$/.test(name) && !/^(resource\.lingxiao\.resource\.[a-z_]+|uses\.(?:lingxiao|youdu)\.skill\.[a-z_]+|fact\.(weaponDamage|weaponXuanfengLevel|weaponXuanfengAttack|metalFireWindEquipmentCount))$/.test(name)) throw new Error('未知表达式标识：' + name);
      evalExpr(value, { source: expressionUnit, target: expressionUnit, skillLevel: 180, targets: 5 });
    } catch (error) { issue(path, String(error)); }
  } else if (Array.isArray(value)) value.forEach((child, i) => walk(child, [...path, i]));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value))
    walk(child, [...path, key], formulaFields.has(key) || path[path.length - 1] === 'attrMods');
}

  walk(pack, []);
}
