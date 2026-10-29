import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import {
  DAO_FORMATION_INSCRIPTION_ID,
  daoFormationInscriptionOf,
} from '@daoyou/game-content/equipment/base';
import { daoFormationMaxLevel } from '@daoyou/game-rules/equipment/projection';
import {
  OPEN_EQUIPMENT_LEVELS,
  EQUIPMENT_ATTRIBUTE_NAMES,
  EQUIPMENT_SLOT_NAMES,
} from '@daoyou/game-domain/equipment';
import { field, quantity } from './helpers';
import type { ItemAdapter } from './types';

/** 物品格上按效果区分。形状要在小格里能分开，不和灵药、武器格抢同一个符号。 */
const INSCRIPTION_ICONS = {
  [DAO_FORMATION_INSCRIPTION_ID.Xuanfeng]: '🗡️',
  [DAO_FORMATION_INSCRIPTION_ID.Lingyao]: '⚡',
  [DAO_FORMATION_INSCRIPTION_ID.Jingang]: '🛡️',
  [DAO_FORMATION_INSCRIPTION_ID.Xuanjia]: '🧿',
  [DAO_FORMATION_INSCRIPTION_ID.Changsheng]: '❤️',
  [DAO_FORMATION_INSCRIPTION_ID.Jifeng]: '🪽',
  [DAO_FORMATION_INSCRIPTION_ID.Dongming]: '🎯',
  [DAO_FORMATION_INSCRIPTION_ID.Liuyun]: '🪷',
  [DAO_FORMATION_INSCRIPTION_ID.Huichun]: '🌱',
} as const satisfies Record<
  (typeof DAO_FORMATION_INSCRIPTION_ID)[keyof typeof DAO_FORMATION_INSCRIPTION_ID],
  string
>;

export function inscriptionPatternIcon(patternId: string): string {
  return INSCRIPTION_ICONS[patternId as keyof typeof INSCRIPTION_ICONS] ?? '🔶';
}

export const inscriptionAdapter: ItemAdapter = (item, def) => {
  const pattern = daoFormationInscriptionOf(def.patternId!)!;
  const equipmentLevel = OPEN_EQUIPMENT_LEVELS.find(
    (level) => def.level! <= daoFormationMaxLevel(level),
  )!;
  const realm = getLevelRealmStage(equipmentLevel).realm;
  return {
    summary: {
      icon: inscriptionPatternIcon(pattern.id),
      color: tierColorMap[realm],
      tier: `${def.level}级`,
      type: '阵纹',
    },
    preview: (options) => ({
      header: [
        field('等级', `${def.level}级`),
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
