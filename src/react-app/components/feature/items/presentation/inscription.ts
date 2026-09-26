import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import { daoFormationInscriptionOf } from '@shared/engine/combat-v6/equipment/content';
import { daoFormationMaxLevel } from '@shared/engine/combat-v6/equipment/inscriptions';
import { OPEN_EQUIPMENT_LEVELS } from '@shared/engine/combat-v6/equipment/realm';
import { EQUIPMENT_ATTRIBUTE_NAMES } from '@shared/inventory/equipment';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';
import { field, quantity } from './helpers';
import type { ItemAdapter } from './types';

export const inscriptionAdapter: ItemAdapter = (item, def) => {
  const pattern = daoFormationInscriptionOf(def.patternId!)!;
  const equipmentLevel = OPEN_EQUIPMENT_LEVELS.find(
    (level) => def.level! <= daoFormationMaxLevel(level),
  )!;
  const realm = getLevelRealmStage(equipmentLevel).realm;
  return {
    summary: {
      icon: '🔶',
      color: tierColorMap[realm],
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
