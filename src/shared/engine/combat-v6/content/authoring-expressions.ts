import { ATTR_NAMES, createUnit, evalExpr } from '../core';
import { ExprFn, ExprVar } from '../core/enums';

const formulaFields = new Set(['costMp', 'costHp', 'count', 'power', 'duration', 'speedMod', 'value', 'factor', 'maxGainPerAction', 'followPower', 'healingPower']);
const allowedVariables = new Set<string>([
  ...ATTR_NAMES, ...Object.values(ExprVar), ...Object.values(ExprFn),
  ...ATTR_NAMES.flatMap(attr => ['source.' + attr, 'target.' + attr]), 'source.level', 'target.level',
]);
const expressionUnit = createUnit({ id: 'config-validation', name: '配置校验', kind: 'npc', side: 0, slot: 0, level: 180, attrs: { hp: 1000, maxHp: 1000, speed: 10, physicalAtk: 10, physicalDef: 10 } }, 0);
export function validateSectExpressions(pack: unknown, issue: (path: (string | number)[], message: string) => void) {
function walk(value: unknown, path: (string | number)[], formula = false) {
  if (typeof value === 'string' && formula) {
    try {
      for (const name of value.match(/[A-Za-z_][A-Za-z0-9_.]*/g) ?? [])
        if (!allowedVariables.has(name)) throw new Error('未知表达式标识：' + name);
      evalExpr(value, { source: expressionUnit, target: expressionUnit, skillLevel: 180, targets: 5 });
    } catch (error) { issue(path, String(error)); }
  } else if (Array.isArray(value)) value.forEach((child, i) => walk(child, [...path, i]));
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value))
    walk(child, [...path, key], formulaFields.has(key) || path[path.length - 1] === 'attrMods');
}

  walk(pack, []);
}
