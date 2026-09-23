import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import { daoEquipmentRequiredLevel } from '@shared/engine/combat-v6/equipment/compiler';
import { daoFormationInscriptionOf } from '@shared/engine/combat-v6/equipment/content';
import { daoFormationMaxLevel, daoFormationPanel } from '@shared/engine/combat-v6/equipment/inscriptions';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@shared/engine/combat-v6/equipment/special-content';
import {
  EQUIPMENT_ATTRIBUTE_NAMES,
  InventoryEquipmentSchema,
} from '@shared/inventory/equipment';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { DAO_WEAPONS, daoWeaponTypeOf } from '@shared/engine/combat-v6/equipment/weapons';
import { CHARACTER_ATTRIBUTE_LABELS } from '@shared/lib/characterAttributeLabels';
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
  old?: ReturnType<typeof InventoryEquipmentSchema.parse>,
  previousName?: string,
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
      delta: old
        ? roll.value - (old[key].find((r) => r.attr === roll.attr)?.value ?? 0)
        : undefined,
    }));
    for (const roll of old?.[key] ?? []) {
      if (!equipment[key].some((r) => r.attr === roll.attr))
        rows.push({
          label:
            key === 'attributeBonuses'
              ? CHARACTER_ATTRIBUTE_LABELS[
                  roll.attr as keyof typeof CHARACTER_ATTRIBUTE_LABELS
                ]
              : EQUIPMENT_ATTRIBUTE_NAMES[roll.attr],
          value: 0,
          numeric: true,
          delta: -roll.value,
        });
    }
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
  if (old) {
    const currentPanel = daoFormationPanel(equipment);
    const previousPanel = daoFormationPanel(old);
    const attributes = new Set([...currentPanel, ...previousPanel].map(roll => roll.attr));
    if (attributes.size)
      sections.push({
        title: '阵纹属性比较',
        entries: [...attributes].map(attr => {
          const value = currentPanel.find(roll => roll.attr === attr)?.value ?? 0;
          return {
            kind: 'line', label: EQUIPMENT_ATTRIBUTE_NAMES[attr], value: signed(value), numeric: true,
            delta: value - (previousPanel.find(roll => roll.attr === attr)?.value ?? 0),
          };
        }),
      });
  }
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
  if (old)
    sections.push({
      title: '比较说明',
      tone: 'muted',
      entries: [
        {
          value: `对比「${previousName}」，箭头表示本件相对已穿戴道装的增减。`,
        },
        {
          label: '已穿戴器蕴',
          value:
            old.essenceIds
              .map(
                (id) =>
                  DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id)?.name ??
                  id,
              )
              .join('、') || '无',
        },
        {
          label: '已穿戴器诀',
          value:
            DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === old.artId)?.name ?? '无',
        },
        { value: '以上为道装属性比较，非人物最终面板。' },
      ].map((row) => ({ kind: 'line', ...row })),
    });
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
    preview: (options) => ({
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
      sections: equipmentSections(
        equipment,
        options.previous
          ? InventoryEquipmentSchema.parse(options.previous.instanceData)
          : undefined,
        options.previous?.name,
      ),
      description: equipment.desc,
      comparison: options.comparisonItem
        ? {
            title: `与已穿戴的${options.comparisonItem.name}比较`,
            sections: equipmentSections(
              equipment,
              InventoryEquipmentSchema.parse(
                options.comparisonItem.instanceData,
              ),
              options.comparisonItem.name,
            ),
          }
        : undefined,
    }),
  };
};
