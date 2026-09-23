import { daoFormationInscriptionOf } from '@shared/engine/combat-v6/equipment/content';
import { EQUIPMENT_ATTRIBUTE_NAMES } from '@shared/inventory/equipment';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { field, quantity } from './helpers';
import type { ItemAdapter } from './types';

export const inscriptionAdapter: ItemAdapter = (item, def) => {
  const pattern = daoFormationInscriptionOf(def.patternId!)!;
  return {
    summary: {
      icon: '🔶',
      color: 'text-teal',
      tier: `${def.level}级`,
      type: '阵纹',
    },
    preview: (options) => ({
      header: [
        quantity(item, options),
        field(
          '适用部位',
          pattern.allowedSlots
            .map((slot) => EQUIPMENT_SLOT_NAMES[slot])
            .join('、'),
        ),
      ],
      sections: [
        {
          title: '烙印加成',
          entries: [
            {
              kind: 'line',
              label: EQUIPMENT_ATTRIBUTE_NAMES[pattern.attr],
              value: `+${pattern.valuePerLevel * def.level!}`,
              numeric: true,
              tone: 'positive',
            },
          ],
        },
      ],
    }),
  };
};
