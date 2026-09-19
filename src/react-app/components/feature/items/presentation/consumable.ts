import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import {
  toPillDisplayModel,
  toSpiritFruitDisplayModel,
  type PillDetailGroup,
} from '../../consumables/pillDisplayModel';
import {
  getTalismanScenarioLabel,
  talismanDetailRows,
} from '../../consumables/talismanDisplay';
import { field, lines, quantity } from './helpers';
import type { ItemAdapter, PreviewTone } from './types';

const groupTones: Record<PillDetailGroup['role'], PreviewTone> = {
  effect: 'positive',
  preview: 'normal',
  restriction: 'warning',
  source: 'muted',
};
export const consumableAdapter: ItemAdapter = (item) => {
  const facts = {
    ...ConsumableFactsSchema.parse(item.instanceData),
    quantity: item.quantity,
  };
  return {
    summary: {
      icon: facts.type === '丹药' ? '🌕' : facts.type === '灵果' ? '🍑' : '🧧',
      color: tierColorMap[facts.quality],
      tier: facts.quality,
      type: facts.type,
    },
    preview: (options) => {
      const type = field('类型', `${facts.quality} · ${facts.type}`);
      if (facts.spec.kind === 'talisman')
        return {
          header: [type, quantity(item, options)],
          sections: [
            {
              title: '道具资料',
              entries: [
                {
                  kind: 'line',
                  label: '用途',
                  value: getTalismanScenarioLabel(facts.spec.scenario),
                },
              ],
            },
            {
              title: '符箓效用',
              entries: talismanDetailRows(facts).map((row) => ({
                kind: 'line',
                ...row,
              })),
            },
          ],
          description: facts.description,
        };
      const model =
        facts.spec.kind === 'pill'
          ? toPillDisplayModel({ ...facts, spec: facts.spec }, options)
          : toSpiritFruitDisplayModel({ ...facts, spec: facts.spec }, options);
      return {
        header: [
          type,
          ...(model.appearance ? [field('丹相', model.appearance.label)] : []),
          field('功能', model.familyLabel),
          quantity(item, options),
        ],
        sections: model.detailGroups
          .filter((group) => group.lines.length)
          .map((group) => ({
            title: group.title,
            entries: group.lines.flatMap((value) => lines(value)),
            tone: groupTones[group.role],
            ...(group.collapsible ? { collapsible: true as const } : {}),
          })),
        description: facts.description,
      };
    },
  };
};
