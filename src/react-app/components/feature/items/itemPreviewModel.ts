import { beastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import { BEAST_REFINEMENT } from '@shared/engine/combat-v6/beasts/refinement-config';
import { daoEquipmentRequiredLevel } from '@shared/engine/combat-v6/equipment/compiler';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@shared/engine/combat-v6/equipment/special-content';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import { itemDefinition } from '@shared/inventory';
import {
  EQUIPMENT_ATTRIBUTE_NAMES,
  InventoryEquipmentSchema,
} from '@shared/inventory/equipment';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { materialFactsOf } from '@shared/items/material';
import { calculatePillScore } from '@shared/lib/pillScore';
import type { CultivatorCondition } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import {
  toPillDisplayModel,
  toSpiritFruitDisplayModel,
} from '../consumables/pillDisplayModel';
import {
  buildTalismanDetailText,
  getTalismanScenarioLabel,
} from '../consumables/talismanDisplay';
import { itemPresentation, type DisplayItem } from './itemPresentation';

export type PreviewTone =
  'normal' | 'accent' | 'positive' | 'warning' | 'muted';
export type PreviewRow = {
  label?: string;
  value: string | number;
  numeric?: boolean;
  delta?: number;
  tone?: PreviewTone;
};
export type PreviewSection = {
  collapsible?: boolean;
  title: string;
  rows: PreviewRow[];
  tone?: PreviewTone;
};
export type PreviewOptions = {
  previous?: DisplayItem;
  realm?: RealmType;
  condition?: CultivatorCondition;
};
export type ItemPreviewModel = ReturnType<typeof itemPresentation> & {
  metadata: PreviewRow[];
  sections: PreviewSection[];
  flavor?: string;
};
const lines = (text: string): PreviewRow[] =>
  text
    .split('\n')
    .filter(Boolean)
    .map((value) => ({ value }));
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value}`;

/** 展示适配只读取已有事实；属性和药效仍以各领域的编译与说明为准。 */
export function itemPreviewModel(
  item: DisplayItem,
  options: PreviewOptions = {},
): ItemPreviewModel {
  const presentation = itemPresentation(item);
  const def = itemDefinition(item.definitionId);
  const metadata: PreviewRow[] = [];
  const sections: PreviewSection[] = [];
  let flavor: string | undefined;
  const type =
    def.kind === 'equipment'
      ? EQUIPMENT_SLOT_NAMES[
          InventoryEquipmentSchema.parse(item.instanceData).slot
        ]
      : presentation.type;
  if (!item.name.includes(type)) metadata.push({ label: '类型', value: type });
  if (
    presentation.tier &&
    def.kind !== 'beast_book' &&
    def.kind !== 'equipment' &&
    def.kind !== 'blueprint' &&
    !item.name.includes(presentation.tier)
  )
    metadata.push({ label: '品质', value: presentation.tier });

  switch (def.kind) {
    case 'equipment': {
      const equipment = InventoryEquipmentSchema.parse(item.instanceData);
      const old = options.previous
        ? InventoryEquipmentSchema.parse(options.previous.instanceData)
        : undefined;
      metadata.push({
        label: '御使',
        value: getLevelRealmStage(daoEquipmentRequiredLevel(equipment)).label,
      });
      for (const key of ['baseStats', 'attributeBonuses'] as const) {
        const rows: PreviewRow[] = equipment[key].map((roll) => ({
          label: EQUIPMENT_ATTRIBUTE_NAMES[roll.attr],
          value: signed(roll.value),
          numeric: true,
          tone: key === 'attributeBonuses' ? 'positive' : 'normal',
          delta: old
            ? roll.value -
              (old[key].find((r) => r.attr === roll.attr)?.value ?? 0)
            : undefined,
        }));
        for (const roll of old?.[key] ?? []) {
          if (!equipment[key].some((r) => r.attr === roll.attr))
            rows.push({
              label: EQUIPMENT_ATTRIBUTE_NAMES[roll.attr],
              value: 0,
              numeric: true,
              delta: -roll.value,
            });
        }
        if (
          key === 'attributeBonuses' &&
          equipment.attributeBonuses.length === 2
        )
          rows.push({
            label: '双加合计',
            value: equipment.attributeBonuses.reduce(
              (sum, r) => sum + r.value,
              0,
            ),
            numeric: true,
            tone: 'positive',
          });
        if (rows.length)
          sections.push({
            title: key === 'baseStats' ? '器胚属性' : '附灵属性',
            rows,
          });
      }
      const essences = equipment.essenceIds
        .map((id) => DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id))
        .filter((e) => e !== undefined);
      if (essences.length)
        sections.push({
          title: '器蕴',
          rows: essences.flatMap((e) => [
            { value: e.name, tone: 'accent' as const },
            ...lines(e.description ?? ''),
          ]),
        });
      const art = DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === equipment.artId);
      if (art) {
        sections.push({
          title: '器诀',
          rows: [
            { value: art.name, tone: 'accent' },
            { label: '战意消耗', value: art.rageCost, numeric: true },
            {
              label: '归元后消耗',
              value: Math.floor(
                art.rageCost *
                  (DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.resourceCostFactors)
                    ?.resourceCostFactors?.['combat.resource.rage'] ?? 1),
              ),
              numeric: true,
            },
            ...lines(art.description),
          ],
        });
      }
      if (old)
        sections.push({
          title: '比较说明',
          tone: 'muted',
          rows: [
            {
              value: `对比「${options.previous!.name}」，箭头表示本件相对已穿戴道装的增减。`,
            },
            {
              label: '已穿戴器蕴',
              value:
                old.essenceIds
                  .map(
                    (id) =>
                      DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id)
                        ?.name ?? id,
                  )
                  .join('、') || '无',
            },
            {
              label: '已穿戴器诀',
              value:
                DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === old.artId)?.name ??
                '无',
            },
            { value: '以上为道装属性比较，非人物最终面板。' },
          ],
        });
      break;
    }
    case 'consumable': {
      const facts = {
        ...ConsumableFactsSchema.parse(item.instanceData),
        quantity: item.quantity,
      };
      if (facts.spec.kind === 'talisman') {
        metadata.push({
          label: '用途',
          value: getTalismanScenarioLabel(facts.spec.scenario),
        });
        sections.push({
          title: '符箓效用',
          rows: lines(buildTalismanDetailText(facts))
            .filter(
              (row) =>
                row.value !==
                `适用玩法：${getTalismanScenarioLabel(facts.spec.kind === 'talisman' ? facts.spec.scenario : '')}`,
            )
            .map((row) => {
              const text = String(row.value);
              const index = text.indexOf('：');
              return index > 0 && index < 7
                ? { label: text.slice(0, index), value: text.slice(index + 1) }
                : row;
            }),
        });
      } else {
        const model =
          facts.spec.kind === 'pill'
            ? toPillDisplayModel({ ...facts, spec: facts.spec }, options)
            : toSpiritFruitDisplayModel(
                { ...facts, spec: facts.spec },
                options,
              );
        metadata.push({ label: '用途', value: model.familyLabel });
        if (facts.spec.kind === 'pill') {
          const score = calculatePillScore(facts);
          if (score !== null)
            metadata.push({ label: '丹评', value: score, numeric: true });
        }
        if (model.appearance)
          metadata.push({ label: '丹相', value: model.appearance.label });
        for (const group of model.detailGroups) {
          if (!group.lines.length) continue;
          sections.push({
            title: group.title,
            collapsible:
              group.key.includes('info') || group.key.includes('source'),
            tone: group.key.includes('rules')
              ? 'warning'
              : group.key.includes('info') || group.key.includes('source')
                ? 'muted'
                : 'normal',
            rows: group.lines.map((value) => ({ value })),
          });
        }
        flavor = facts.description;
      }
      break;
    }
    case 'beast_book': {
      const skill = beastSkillPresentation(def.skillId!);
      sections.push({
        title: '所载传承',
        rows: [
          { value: skill.name, tone: 'accent' },
          ...lines(skill.description),
        ],
      });
      flavor = presentation.inheritance?.introduction;
      break;
    }
    case 'beast_refinement': {
      const dew = BEAST_REFINEMENT.items.find((d) => d.id === def.id)!;
      metadata.push({ label: '用途', value: '灵兽洗炼' });
      sections.push(
        {
          title: '适用物种',
          rows: [{ value: dew.allowedRealms.join('、'), tone: 'accent' }],
        },
        {
          title: '洗炼效果',
          rows: [
            {
              value:
                '重归初生，重新孕育资质、成长与天生技能，恢复寿命至原上限。',
            },
            ...(dew.color === 'gold'
              ? [
                  {
                    value:
                      '元婴及以上物种须用此露；不额外提高资质、成长或多技能概率。',
                  },
                ]
              : []),
          ],
        },
      );
      break;
    }
    case 'blueprint':
      metadata.push(
        { label: '部位', value: EQUIPMENT_SLOT_NAMES[def.slot!] },
        { label: '铸造境界', value: getLevelRealmStage(def.level!).label },
      );
      sections.push(
        {
          title: '图纸用途',
          rows: [
            {
              value: `用于铸造${EQUIPMENT_SLOT_NAMES[def.slot!]}，每次消耗一张。`,
            },
          ],
        },
        {
          title: '使用条件',
          rows: [{ value: '不可铸造高于人物境界的图纸。' }],
          tone: 'warning',
        },
      );
      break;
    case 'material': {
      const facts = materialFactsOf(item.definitionId, item.instanceData);
      if (facts.element) metadata.push({ label: '五行', value: facts.element });
      sections.push({
        title: '材料特性',
        rows: lines(facts.description || '可用于对应炼造玩法的灵材。'),
      });
      break;
    }
    case 'manual_jade': {
      const manual = CHARACTER_MANUALS_V1.find((m) => m.id === def.manualId)!;
      metadata.push({ label: '传承境界', value: manual.realm });
      sections.push({
        title: '所载功法',
        rows: [
          { value: manual.name, tone: 'accent' },
          ...lines(manual.description),
        ],
      });
      break;
    }
    case 'seed':
      metadata.push({ label: '用途', value: '灵田培育' });
      sections.push({
        title: '灵种特性',
        rows: lines(presentation.description || '可在洞府灵田中播种培育。'),
      });
      break;
  }
  return { ...presentation, metadata, sections, flavor };
}
