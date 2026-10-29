import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { daoFormationInscriptionOf } from '@daoyou/game-content/equipment/base';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@daoyou/game-content/equipment/special';
import { DAO_WEAPONS } from '@daoyou/game-content/equipment/weapons';
import { CHARACTER_ATTRIBUTE_LABELS } from '@daoyou/game-domain/character';
import {
  EQUIPMENT_ATTRIBUTE_NAMES,
  EQUIPMENT_SLOT_NAMES,
  daoWeaponTypeOf,
} from '@daoyou/game-domain/equipment';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import { formatCharacterAttributeValue } from '@daoyou/game-rules/character/display';
import {
  daoEquipmentRequiredLevel,
  daoFormationMaxLevel,
  equipmentRollDifference,
  type EquipmentReplacementPreview,
} from '@daoyou/game-rules/equipment/projection';
import { InventoryEquipmentSchema } from '@daoyou/game-rules/inventory/equipment';
import { field, lines } from './helpers';
import { inscriptionPatternIcon } from './inscription';
import type {
  ItemAdapter,
  PreviewEntry,
  PreviewLine,
  PreviewSection,
} from './types';
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
  comparison?: EquipmentReplacementPreview,
): PreviewSection[] {
  const sections: PreviewSection[] = [];
  const delta = (value: number, attr: string): PreviewLine['comparison'] =>
    Math.abs(value) < 1e-8
      ? undefined
      : {
          value: `${value > 0 ? '↑ +' : '↓ −'}${formatCharacterAttributeValue(attr, Number(Math.abs(value).toFixed(6)))}`,
          tone: value > 0 ? 'positive' : 'warning',
        };
  for (const key of ['baseStats', 'attributeBonuses'] as const) {
    const label = (attr: string) =>
      key === 'attributeBonuses'
        ? CHARACTER_ATTRIBUTE_LABELS[
            attr as keyof typeof CHARACTER_ATTRIBUTE_LABELS
          ]
        : EQUIPMENT_ATTRIBUTE_NAMES[
            attr as keyof typeof EQUIPMENT_ATTRIBUTE_NAMES
          ];
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
      comparison: comparison
        ? delta(
            equipmentRollDifference(
              equipment[key],
              comparison.previous?.[key],
              roll.attr,
            ),
            roll.attr,
          )
        : undefined,
    }));
    if (comparison)
      for (const old of comparison.previous?.[key] ?? []) {
        if (!equipment[key].some((r) => r.attr === old.attr))
          rows.push({
            label: label(old.attr),
            value: '—',
            comparison: delta(-old.value, old.attr),
            numeric: true,
          });
      }
    if (rows.length)
      sections.push({
        title: key === 'baseStats' ? '器胚属性' : '附灵属性',
        entries: rows.map((row) => ({ kind: 'line', ...row })),
      });
  }
  const formationRows: PreviewLine[] =
    equipment.formationInscriptions.flatMap<PreviewLine>((formation, index) => {
      const old = comparison?.previous?.formationInscriptions[index];
      if (!formation)
        return old
          ? [
              {
                label: `第${index + 1}孔`,
                value: `${inscriptionPatternIcon(old.patternId)} ${daoFormationInscriptionOf(old.patternId)!.name} · ${old.level}级（移除）`,
                tone: 'warning' as const,
              },
              {
                label:
                  EQUIPMENT_ATTRIBUTE_NAMES[
                    daoFormationInscriptionOf(old.patternId)!.attr
                  ],
                value: '—',
                numeric: true,
                comparison: delta(
                  -daoFormationInscriptionOf(old.patternId)!.valuePerLevel *
                    old.level,
                  daoFormationInscriptionOf(old.patternId)!.attr,
                ),
              },
            ]
          : [];
      const definition = daoFormationInscriptionOf(formation.patternId)!;
      const oldDef = old
        ? daoFormationInscriptionOf(old.patternId)!
        : undefined;
      const oldValue =
        old && oldDef?.attr === definition.attr
          ? oldDef.valuePerLevel * old.level
          : 0;
      return [
        {
          label: `第${index + 1}孔`,
          value: `${inscriptionPatternIcon(definition.id)} ${definition.name} · ${formation.level}级`,
          comparison:
            comparison && old?.patternId !== formation.patternId
              ? {
                  value: old
                    ? `原 ${inscriptionPatternIcon(old.patternId)} ${oldDef!.name} ${old.level}级`
                    : '新增',
                  tone: 'muted' as const,
                }
              : undefined,
        },
        {
          label: EQUIPMENT_ATTRIBUTE_NAMES[definition.attr],
          value: signed(definition.valuePerLevel * formation.level),
          numeric: true,
          tone: 'positive' as const,
          comparison: comparison
            ? delta(
                definition.valuePerLevel * formation.level - oldValue,
                definition.attr,
              )
            : undefined,
        },
        ...(old && oldDef && oldDef.attr !== definition.attr
          ? [
              {
                label: `原${EQUIPMENT_ATTRIBUTE_NAMES[oldDef.attr]}`,
                value: '—',
                comparison: delta(
                  -oldDef.valuePerLevel * old.level,
                  oldDef.attr,
                ),
                numeric: true,
              },
            ]
          : []),
      ];
    });
  if (formationRows.length)
    sections.push({
      title: '阵纹',
      entries: [
        {
          kind: 'line',
          label: '每孔上限',
          value: `${daoFormationMaxLevel(equipment.equipmentLevel)}级`,
          numeric: true,
        },
        ...formationRows.map((row) => ({ kind: 'line' as const, ...row })),
      ],
    });
  const essences = equipment.essenceIds
    .map((id) => DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id))
    .filter((e) => e !== undefined);
  const essenceEntries: Extract<PreviewEntry, { kind: 'disclosure' }>[] =
    essences.map((e) => {
      const change = comparison?.essences.find((c) => c.id === e.id);
      const suffix = change
        ? !change.before
          ? ' · 新增'
          : ` · 生效${change.before}→${change.after}件`
        : comparison &&
            e.stackPolicy !== 'stack' &&
            comparison.beforeEssenceIds.includes(e.id) &&
            !comparison.previous?.essenceIds.includes(e.id)
          ? ' · 已生效，不叠加'
          : '';
      return {
        kind: 'disclosure' as const,
        title: e.name + suffix,
        tone: 'accent' as const,
        rows: lines(e.description ?? ''),
      };
    });
  for (const change of comparison?.essences ?? [])
    if (!essences.some((e) => e.id === change.id)) {
      essenceEntries.push({
        kind: 'disclosure',
        title: `${change.name} · ${change.after ? `生效${change.before}→${change.after}件` : '失去'}`,
        tone: 'warning',
        rows: lines(change.description ?? ''),
      });
    }
  if (essenceEntries.length)
    sections.push({
      title: '器蕴',
      entries: essenceEntries,
    });
  const art = DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === equipment.artId);
  const artEntries: Extract<PreviewEntry, { kind: 'disclosure' }>[] = art
    ? [
        {
          kind: 'disclosure' as const,
          title:
            art.name +
            (comparison && !comparison.beforeArtIds.includes(art.id)
              ? ' · 新增'
              : ''),
          tone: 'accent' as const,
          rows: [
            ...lines(art.description),
            { label: '战意消耗', value: art.rageCost, numeric: true },
          ],
        },
      ]
    : [];
  for (const change of comparison?.arts ?? []) {
    const existing = art && change.id === art.id ? artEntries[0] : undefined;
    if (existing) {
      if (
        change.before &&
        change.after &&
        change.beforeCost !== change.afterCost
      )
        existing.rows.push({
          label: '实际战意',
          value: `${change.beforeCost} → ${change.afterCost}`,
          numeric: true,
        });
      if (!change.before && change.after && change.afterCost !== art?.rageCost)
        existing.rows.push({
          label: '换装后战意',
          value: change.afterCost ?? 0,
          numeric: true,
        });
    } else
      artEntries.push({
        kind: 'disclosure',
        title: `${change.name} · ${change.after ? '消耗变化' : '失去'}`,
        tone: change.after ? 'accent' : 'warning',
        rows: [
          ...lines(change.description),
          {
            label: '实际战意',
            value: `${change.beforeCost ?? '未拥有'} → ${change.afterCost ?? '未拥有'}`,
            numeric: true,
          },
        ],
      });
  }
  if (artEntries.length) {
    sections.push({
      title: '器诀',
      entries: artEntries,
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
      sections: equipmentSections(equipment, options.equipmentComparison),
      description: equipment.desc,
    }),
  };
};
