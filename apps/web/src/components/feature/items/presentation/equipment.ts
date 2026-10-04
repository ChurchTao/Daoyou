import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import {
  daoEquipmentRequiredLevel,
  daoFormationMaxLevel,
} from '@daoyou/game-rules/equipment/projection';
import { daoFormationInscriptionOf } from '@daoyou/game-content/equipment/base';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@daoyou/game-content/equipment/special';
import {
  EQUIPMENT_ATTRIBUTE_NAMES,
  EQUIPMENT_SLOT_NAMES,
  daoWeaponTypeOf,
} from '@daoyou/game-domain/equipment';
import { InventoryEquipmentSchema } from '@daoyou/game-rules/inventory/equipment';
import { DAO_WEAPONS } from '@daoyou/game-content/equipment/weapons';
import { CHARACTER_ATTRIBUTE_LABELS } from '@daoyou/game-domain/character';
import { field, lines } from './helpers';
import type { ItemAdapter, PreviewLine, PreviewSection } from './types';
const icons = {
  weapon: '⚔️',
  head: '👑',
  armor: '🥋',
  necklace: '📿',
  belt: '🎗️',
  footwear: '👢',
};
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;
function equipmentSections(
  equipment: ReturnType<typeof InventoryEquipmentSchema.parse>,
): PreviewSection[] {
  const sections: PreviewSection[] = [];
  for (const key of ['baseStats', 'attributeBonuses'] as const) {
    const rows: PreviewLine[] = equipment[key].map((roll) => ({
      label:
        key === 'attributeBonuses'
          ? CHARACTER_ATTRIBUTE_LABELS[
              roll.attr as keyof typeof CHARACTER_ATTRIBUTE_LABELS
            ]
          : EQUIPMENT_ATTRIBUTE_NAMES[roll.attr],
      value: signed(roll.value),
      numeric: true,
      tone: key === 'attributeBonuses' ? 'positive' : 'normal',
    }));
    if (rows.length)
      sections.push({
        title: key === 'baseStats' ? '器胚属性' : '附灵属性',
        entries: rows.map((row) => ({ kind: 'line', ...row })),
      });
  }
  const formationRows: PreviewLine[] = equipment.formationInscriptions.flatMap((formation, index) => {
    if (!formation) return [];
    const definition = daoFormationInscriptionOf(formation.patternId)!;
    return [{
      label: `第${index + 1}孔`,
      value: `${definition.name} · ${formation.level}级`,
    }, {
      label: EQUIPMENT_ATTRIBUTE_NAMES[definition.attr],
      value: signed(definition.valuePerLevel * formation.level),
      numeric: true,
      tone: 'positive' as const,
    }];
  });
  if (formationRows.length)
    sections.push({
      title: '阵纹',
      entries: [
        { kind: 'line', label: '每孔上限', value: `${daoFormationMaxLevel(equipment.equipmentLevel)}级`, numeric: true },
        ...formationRows.map(row => ({ kind: 'line' as const, ...row })),
      ],
    });
  const essences = equipment.essenceIds
    .map((id) => DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id))
    .filter((e) => e !== undefined);
  if (essences.length)
    sections.push({
      title: '器蕴',
      entries: essences.map((e) => ({
        kind: 'disclosure',
        title: e.name,
        tone: 'accent',
        rows: lines(e.description ?? ''),
      })),
    });
  const art = DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === equipment.artId);
  if (art) {
    sections.push({
      title: '器诀',
      entries: [
        {
          kind: 'disclosure',
          title: art.name,
          tone: 'accent',
          rows: [
            ...lines(art.description),
            { label: '战意消耗', value: art.rageCost, numeric: true },
          ],
        },
      ],
    });
  }
  return sections;
}
export const equipmentAdapter: ItemAdapter = (item) => {
  const equipment = InventoryEquipmentSchema.parse(item.instanceData);
  const weaponType = daoWeaponTypeOf(equipment);
  const equipmentType = weaponType
    ? `${EQUIPMENT_SLOT_NAMES[equipment.slot]} · ${DAO_WEAPONS[weaponType].name}`
    : EQUIPMENT_SLOT_NAMES[equipment.slot];
  const tier = getLevelRealmStage(equipment.equipmentLevel).realm;
  return {
    summary: {
      icon: icons[equipment.slot],
      color: tierColorMap[tier],
      type: `${equipmentType} · 御使境界`,
      tier,
    },
    preview: () => ({
      header: [
        field('类型', equipmentType),
        field(
          '要求',
          getLevelRealmStage(daoEquipmentRequiredLevel(equipment)).label,
        ),
        ...(equipment.element ? [field('五行', equipment.element)] : []),
        ...(equipment.crafterName
          ? [field('铸造者', equipment.crafterName)]
          : []),
        ...(item.equipped
          ? [{ kind: 'status' as const, value: '已穿戴' }]
          : []),
      ],
      sections: equipmentSections(equipment),
      description: equipment.desc,
    }),
  };
};
