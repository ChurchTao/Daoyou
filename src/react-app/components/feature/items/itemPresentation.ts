import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { combatV6SkillDetails } from '@shared/combat-v6/skill-details';
import type { InventoryView } from '@shared/contracts/inventory';
import { BEAST_SKILLS } from '@shared/engine/combat-v6/beasts';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import { itemDefinition } from '@shared/inventory';
import { InventoryEquipmentSchema } from '@shared/inventory/equipment';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@shared/types/constants';

export type DisplayItem = Pick<
  InventoryView['items'][number],
  'name' | 'definitionId' | 'instanceData' | 'quantity'
> & { equipped?: boolean };
const skills = combatV6SkillDetails(BEAST_SKILLS, []);
const equipmentIcons = {
  weapon: '⚔️',
  head: '👑',
  armor: '🥋',
  necklace: '📿',
  belt: '🎗️',
  footwear: '👢',
};
function levelTier(level: number) {
  const realm =
    REALM_VALUES[
      Math.min(
        REALM_VALUES.length - 1,
        Math.floor(
          Math.max(0, Math.ceil(level / 5) - 1) / REALM_STAGE_VALUES.length,
        ),
      )
    ];
  return { color: tierColorMap[realm], tier: `${realm} · ${level}级` };
}
export function itemPresentation(item: DisplayItem) {
  const def = itemDefinition(item.definitionId);
  switch (def.kind) {
    case 'consumable': {
      const facts = ConsumableFactsSchema.parse(item.instanceData);
      return {
        icon:
          facts.type === '丹药' ? '🌕' : facts.type === '灵果' ? '🍑' : '🧧',
        color: tierColorMap[facts.quality],
        tier: facts.quality,
        type: facts.type,
        description: facts.description,
      };
    }
    case 'material': {
      const facts = materialFactsOf(item.definitionId, item.instanceData);
      return {
        icon: { herb: '🌿', ore: '🪨', tcdb: '💎', aux: '🧵', monster: '🦴' }[
          facts.type
        ],
        color: tierColorMap[facts.rank],
        tier: facts.rank,
        type: MATERIAL_TYPE_NAMES[facts.type],
        description: facts.description,
      };
    }
    case 'equipment': {
      const equipment = InventoryEquipmentSchema.parse(item.instanceData);
      return {
        icon: equipmentIcons[equipment.slot],
        ...levelTier(equipment.requiredLevel),
        type: `${EQUIPMENT_SLOT_NAMES[equipment.slot]} · 原始穿戴等级`,
        description: '',
      };
    }
    case 'blueprint':
      return {
        icon: '📜',
        ...levelTier(def.level!),
        type: '道装图纸',
        description: `${EQUIPMENT_SLOT_NAMES[def.slot!]}图纸，铸造消耗一张。不可铸造高于人物等级的图纸。`,
      };
    case 'beast_book': {
      const advanced = def.skillId?.includes('advanced-');
      return {
        icon: '📕',
        color: tierColorMap[advanced ? '玄品' : '凡品'],
        tier: advanced ? '高级' : '普通',
        type: '兽诀',
        description: `${skills[def.skillId!]?.description ?? ''}\n学习消耗一本，随机覆盖一个已有技能，结果不可撤销。同系普通与高级技能同时存在时仅高级生效。`,
      };
    }
    case 'manual_jade':
      return {
        icon: '📗',
        color: tierColorMap.凡品,
        tier: '',
        type: '功法玉简',
        description:
          CHARACTER_MANUALS_V1.find((m) => m.id === def.manualId)
            ?.description ?? '',
      };
  }
}
