import { z } from 'zod';
import type { CombatV6ProjectionDiagnostic } from '../projection/types';
import { daoFormationInscriptionOf } from './content';
import type { DaoEquipmentInstanceV1, DaoEquipmentPanelRoll, DaoEquipmentSlot } from './types';

const inscription = z.strictObject({
  patternId: z.string().min(1),
  level: z.number().int().positive(),
}).nullable();

export const FormationInscriptionsSchema = z.tuple([inscription, inscription]);

/** 按资产档位明确配置，不外推尚未开放的境界。 */
const LEVEL_LIMITS = [
  { equipmentLevel: 10, maxLevel: 3 },
  { equipmentLevel: 30, maxLevel: 5 },
  { equipmentLevel: 50, maxLevel: 7 },
  { equipmentLevel: 70, maxLevel: 9 },
  { equipmentLevel: 90, maxLevel: 11 },
] as const;

export function daoFormationMaxLevel(equipmentLevel: number): number {
  return LEVEL_LIMITS.find(rule => rule.equipmentLevel === equipmentLevel)?.maxLevel ?? 0;
}

/** 库存解析和战斗投影共用双孔、类型、部位、等级校验。 */
export function validateFormationInscriptions(equipment: {
  slot: DaoEquipmentSlot;
  equipmentLevel: number;
  formationInscriptions: unknown;
}): CombatV6ProjectionDiagnostic[] {
  const parsed = FormationInscriptionsSchema.safeParse(equipment.formationInscriptions);
  if (!parsed.success) return parsed.error.issues.map(issue => ({
    severity: 'error',
    code: issue.path[issue.path.length - 1] === 'level' ? 'FORMATION_INSCRIPTION_LEVEL_INVALID' : 'FORMATION_INSCRIPTION_SLOTS_INVALID',
    message: '阵纹须为固定双孔，空孔为 null，已烙印阵纹等级须为正整数',
    path: ['formationInscriptions', ...issue.path].join('.'),
  }));
  const diagnostics: CombatV6ProjectionDiagnostic[] = [];
  const maxLevel = daoFormationMaxLevel(equipment.equipmentLevel);
  parsed.data.forEach((formation, index) => {
    if (!formation) return;
    const definition = daoFormationInscriptionOf(formation.patternId);
    const path = `formationInscriptions.${index}`;
    if (!definition) diagnostics.push({
      severity: 'error', code: 'UNKNOWN_FORMATION_INSCRIPTION',
      message: '阵纹不存在', path: `${path}.patternId`,
    });
    else if (!definition.allowedSlots.includes(equipment.slot)) diagnostics.push({
      severity: 'error', code: 'FORMATION_INSCRIPTION_SLOT_MISMATCH',
      message: '阵纹不能烙印于该部位', path: `${path}.patternId`,
    });
    if (formation.level > maxLevel) diagnostics.push({
      severity: 'error', code: 'FORMATION_INSCRIPTION_LEVEL_INVALID',
      message: `该装备每孔阵纹等级上限为 ${maxLevel}`, path: `${path}.level`,
    });
  });
  return diagnostics;
}

/** 仅用于通过校验的装备；双孔固定属性相加，不乘器形或材料倍率。 */
export function daoFormationPanel(equipment?: Pick<DaoEquipmentInstanceV1, 'formationInscriptions'>): DaoEquipmentPanelRoll[] {
  const panel = new Map<DaoEquipmentPanelRoll['attr'], number>();
  for (const formation of equipment?.formationInscriptions ?? []) {
    if (!formation) continue;
    const definition = daoFormationInscriptionOf(formation.patternId)!;
    panel.set(definition.attr, (panel.get(definition.attr) ?? 0) + definition.valuePerLevel * formation.level);
  }
  return [...panel].map(([attr, value]) => ({ attr, value }));
}
