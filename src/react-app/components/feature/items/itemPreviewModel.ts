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
import { SeedFactsSchema } from '@shared/items/definitions/seeds';
import { materialFactsOf } from '@shared/items/material';
import { calculatePillScore } from '@shared/lib/pillScore';
import type { CultivatorCondition } from '@shared/types/condition';
import { REALM_VALUES, type RealmType } from '@shared/types/constants';
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
  children?: PreviewRow[];
  collapsible?: boolean;
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
  identity: PreviewRow[];
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
  let flavor: string | undefined = presentation.description;
  const type =
    def.kind === 'equipment'
      ? EQUIPMENT_SLOT_NAMES[
          InventoryEquipmentSchema.parse(item.instanceData).slot
        ]
      : presentation.type;
  const identity: PreviewRow[] = [
    {
      label: '类型',
      value:
        presentation.tier &&
        def.kind !== 'equipment' &&
        def.kind !== 'blueprint'
          ? `${presentation.tier} · ${type}`
          : type,
    },
  ];

  switch (def.kind) {
    case 'equipment': {
      const equipment = InventoryEquipmentSchema.parse(item.instanceData);
      const old = options.previous
        ? InventoryEquipmentSchema.parse(options.previous.instanceData)
        : undefined;
      identity.push({
        label: '要求',
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
          rows: essences.map((e) => ({
            value: e.name,
            tone: 'accent',
            children: lines(e.description ?? ''),
            collapsible: true,
          })),
        });
      const art = DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === equipment.artId);
      if (art) {
        sections.push({
          title: '器诀',
          rows: [
            {
              value: art.name,
              tone: 'accent',
              collapsible: true,
              children: [
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
          rows: lines(buildTalismanDetailText({ ...facts, description: '' }))
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
        identity.push({ label: '功能', value: model.familyLabel });
        identity.push({ label: '要求', value: '场外服用' });
        if (facts.spec.kind === 'pill') {
          const score = calculatePillScore(facts);
          if (score !== null)
            metadata.push({ label: '丹评', value: score, numeric: true });
        }
        if (model.appearance)
          metadata.push({ label: '丹相', value: model.appearance.label });
        for (const group of model.detailGroups) {
          const groupLines = group.lines.filter(
            (value) => value !== '仅可在场外服用',
          );
          if (!groupLines.length) continue;
          sections.push({
            title: group.title,
            collapsible:
              group.key.includes('info') || group.key.includes('source'),
            tone: group.key.includes('rules')
              ? 'warning'
              : group.key.includes('info') || group.key.includes('source')
                ? 'muted'
                : group.key === 'core-effects'
                  ? 'positive'
                  : 'normal',
            rows: groupLines.map((value) => ({ value })),
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
          {
            value: skill.name,
            tone: 'accent',
            children: lines(skill.description),
          },
        ],
      });
      flavor = presentation.inheritance?.introduction;
      break;
    }
    case 'beast_refinement': {
      const dew = BEAST_REFINEMENT.items.find((d) => d.id === def.id)!;
      identity.push(
        { label: '功能', value: '灵兽洗炼' },
        {
          label: '要求',
          value:
            dew.allowedRealms.length === REALM_VALUES.length
              ? '各境界灵兽均可使用'
              : `${dew.allowedRealms.join('、')}物种`,
        },
      );
      sections.push({
        title: '洗炼效果',
        rows: [
          {
            value: '重归初生，重新孕育资质、成长与天生技能，恢复寿命至原上限。',
          },
        ],
      });
      break;
    }
    case 'blueprint':
      identity.push({
        label: '要求',
        value: `${getLevelRealmStage(def.level!).label}及以上可铸造`,
      });
      metadata.push(
        { label: '部位', value: EQUIPMENT_SLOT_NAMES[def.slot!] },
        { label: '铸造境界', value: getLevelRealmStage(def.level!).label },
      );
      flavor = `记载${EQUIPMENT_SLOT_NAMES[def.slot!]}铸造之法的图纸，铸造时消耗一张。`;
      break;
    case 'material': {
      const facts = materialFactsOf(item.definitionId, item.instanceData);
      if (facts.element) metadata.push({ label: '五行', value: facts.element });
      flavor = facts.description || '可用于对应炼造玩法的灵材。';
      break;
    }
    case 'manual_jade': {
      const manual = CHARACTER_MANUALS_V1.find((m) => m.id === def.manualId)!;
      metadata.push({ label: '传承境界', value: manual.realm });
      flavor = '封存功法传承的玉简，可于悟道室参悟其中法门。';
      sections.push({
        title: '所载功法',
        rows: [
          {
            value: manual.name,
            tone: 'accent',
            children: lines(manual.description),
          },
        ],
      });
      break;
    }
    case 'seed': {
      const { plant } = SeedFactsSchema.parse(item.instanceData).seedSpec;
      identity.push(
        { label: '功能', value: '灵田培育' },
        { label: '要求', value: `${plant.minRealm}及以上可播种` },
      );
      metadata.push({ label: '五行', value: plant.element });
      if (plant.clueTexts.length)
        sections.push({
          title: '培育线索',
          rows: lines(plant.clueTexts.join('\n')),
        });
      flavor = plant.seedDescription;
      break;
    }
  }
  if (metadata.length) sections.unshift({ title: '道具资料', rows: metadata });
  return { ...presentation, identity, sections, flavor };
}
