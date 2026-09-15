import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { beastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import type { InventoryView } from '@shared/contracts/inventory';
import { BEAST_REFINEMENT } from '@shared/engine/combat-v6/beasts/refinement-config';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import { itemDefinition } from '@shared/inventory';
import { InventoryEquipmentSchema } from '@shared/inventory/equipment';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { SeedFactsSchema } from '@shared/items/definitions/seeds';
import { materialFactsOf } from '@shared/items/material';
import { createElement } from 'react';
import { OriginDewIcon } from './OriginDewIcon';

export type DisplayItem = Pick<
  InventoryView['items'][number],
  'name' | 'definitionId' | 'instanceData' | 'quantity'
> & { equipped?: boolean };
const equipmentIcons = {
  weapon: '⚔️',
  head: '👑',
  armor: '🥋',
  necklace: '📿',
  belt: '🎗️',
  footwear: '👢',
};
function levelTier(level: number) {
  const { realm } = getLevelRealmStage(level);
  return { color: tierColorMap[realm], tier: realm };
}
export function itemPresentation(item: DisplayItem) {
  const def = itemDefinition(item.definitionId);
  switch (def.kind) {
    case 'seed': {
      const { plant } = SeedFactsSchema.parse(item.instanceData).seedSpec;
      return {
        icon: '🌱',
        color: tierColorMap[plant.quality],
        tier: plant.quality,
        type: '灵种',
        description: plant.seedDescription,
      };
    }

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
        ...levelTier(equipment.equipmentLevel),
        type: `${EQUIPMENT_SLOT_NAMES[equipment.slot]} · 御使境界`,
        description: '',
      };
    }
    case 'blueprint':
      return {
        icon: '📜',
        ...levelTier(def.level!),
        type: '道装图纸',
        description: `${EQUIPMENT_SLOT_NAMES[def.slot!]}图纸，铸造消耗一张。不可铸造高于人物境界的图纸。`,
      };
    case 'beast_refinement': {
      const dew = BEAST_REFINEMENT.items.find((item) => item.id === def.id)!;
      return {
        icon: createElement(OriginDewIcon, {
          className: dew.color === 'jade' ? 'text-teal' : 'text-tier-tian',
        }),
        color: dew.color === 'jade' ? 'text-teal' : 'text-tier-tian',
        tier: '',
        type: '归元灵露',
        description: dew.description,
      };
    }
    case 'beast_book': {
      const skill = beastSkillPresentation(def.skillId!);
      const advanced = skill.style === 'advanced';
      const introduction = advanced
        ? '封存着更为精深的妖灵传承，可助灵兽领悟其中的本领。'
        : '封存着妖灵传承的灵念，可助灵兽领悟其中的本领。';
      return {
        icon: advanced ? '📕' : '📘',
        color: tierColorMap[advanced ? '玄品' : '凡品'],
        tier:
          skill.style === 'unavailable' ? '已失效' : advanced ? '上品' : '普通',
        type: '传承灵印',
        description: `${introduction}\n所载传承：${skill.name}\n${skill.description}`,
        inheritance: {
          introduction,
          name: skill.name,
          description: skill.description,
        },
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
