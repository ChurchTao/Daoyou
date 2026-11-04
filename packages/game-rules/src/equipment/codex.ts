import { DAO_EQUIPMENT_TEMPLATES_V1 } from '@daoyou/game-content/equipment/base';
import {
  DAO_EQUIPMENT_SPECIAL_GENERATION,
  equipmentArtPool,
  equipmentEssencePool,
} from '@daoyou/game-content/equipment/forging';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@daoyou/game-content/equipment/special';
import {
  DAO_EQUIPMENT_SLOTS,
  EQUIPMENT_ATTRIBUTE_NAMES,
  EQUIPMENT_LEVELS,
  EQUIPMENT_SLOT_NAMES,
  type CombatV6PanelAttr,
  type DaoEquipmentSlot,
  type DaoWeaponType,
} from '@daoyou/game-domain/equipment';
import { equipmentRealm } from './realm.js';
import { daoEquipmentBaseRange } from './ranges.js';

export interface EquipmentCodexRange {
  min: number;
  max: number;
}

export interface EquipmentCodexStat {
  attr: CombatV6PanelAttr;
  label: string;
  /** 材料刚好达到品阶门槛时的白字窗口。 */
  base: EquipmentCodexRange;
  /** 平均高出两阶、白字顶到最高端时的窗口。 */
  peak: EquipmentCodexRange;
}

export interface EquipmentCodexEssence {
  id: string;
  name: string;
  description: string;
  /** 打造时可以出现的部位。与境界无关。 */
  slots: DaoEquipmentSlot[];
}

export interface EquipmentCodexArt {
  id: string;
  name: string;
  description: string;
  rageCost: number;
  /** 打造时可以出现的部位。与境界无关。 */
  slots: DaoEquipmentSlot[];
}

export interface EquipmentCodexSlot {
  slot: DaoEquipmentSlot;
  name: string;
  stats: EquipmentCodexStat[];
}

export interface EquipmentCodexRealm {
  level: number;
  realm: string;
  requiredLevel: number;
  slots: EquipmentCodexSlot[];
}

export interface EquipmentCodexAffixes {
  essences: EquipmentCodexEssence[];
  arts: EquipmentCodexArt[];
}

/** 按开放器阶列出各部位白字窗口。器蕴与器诀见 listEquipmentCodexAffixes。 */
export function listEquipmentCodex(
  weaponType: DaoWeaponType = 'sword',
): EquipmentCodexRealm[] {
  return EQUIPMENT_LEVELS.map((level) => {
    const realm = equipmentRealm(level);
    return {
      level,
      realm: realm.realm,
      requiredLevel: realm.requiredLevel,
      slots: DAO_EQUIPMENT_SLOTS.map((slot) =>
        codexSlot(level, slot, weaponType),
      ),
    };
  });
}

/** 器蕴与器诀各列一次，并标出可以出现的部位。 */
export function listEquipmentCodexAffixes(): EquipmentCodexAffixes {
  return {
    essences: DAO_EQUIPMENT_SPECIAL_GENERATION.essencePool.map((id) => {
      const definition = DAO_EQUIPMENT_ESSENCES_V1.find(
        (entry) => entry.id === id,
      );
      if (!definition?.description) throw new Error(`器蕴缺少说明：${id}`);
      return {
        id,
        name: definition.name,
        description: definition.description,
        slots: slotsInPool(id, equipmentEssencePool),
      };
    }),
    arts: DAO_EQUIPMENT_SPECIAL_GENERATION.artPool.map((id) => {
      const definition = DAO_EQUIPMENT_ARTS_V1.find((entry) => entry.id === id);
      if (!definition) throw new Error(`器诀缺少说明：${id}`);
      return {
        id,
        name: definition.name,
        description: definition.description,
        rageCost: definition.rageCost,
        slots: slotsInPool(id, equipmentArtPool),
      };
    }),
  };
}

function slotsInPool(
  id: string,
  pool: (slot: DaoEquipmentSlot) => readonly string[],
): DaoEquipmentSlot[] {
  return DAO_EQUIPMENT_SLOTS.filter((slot) => pool(slot).includes(id));
}

function codexSlot(
  level: number,
  slot: DaoEquipmentSlot,
  weaponType: DaoWeaponType,
): EquipmentCodexSlot {
  const template = DAO_EQUIPMENT_TEMPLATES_V1.find(
    (entry) => entry.slot === slot,
  );
  if (!template) throw new Error(`缺少部位模板：${slot}`);
  const shape = slot === 'weapon' ? weaponType : undefined;
  return {
    slot,
    name: EQUIPMENT_SLOT_NAMES[slot],
    stats: template.baseStats.map((stat) => ({
      attr: stat.attr,
      label: EQUIPMENT_ATTRIBUTE_NAMES[stat.attr],
      base: daoEquipmentBaseRange(stat, level, 0, shape),
      peak: daoEquipmentBaseRange(stat, level, 1, shape),
    })),
  };
}
