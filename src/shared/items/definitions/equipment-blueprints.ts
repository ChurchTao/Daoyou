import { getLevelRealmStage } from '@shared/config/realmProgression';
import { EQUIPMENT_LEVELS } from '../../engine/combat-v6/equipment/realm';
import { DAO_EQUIPMENT_SLOTS } from '../../engine/combat-v6/equipment/types';
export const EQUIPMENT_SLOT_NAMES = {
  weapon: '法兵',
  head: '法冠',
  armor: '法衣',
  necklace: '灵佩',
  belt: '腰封',
  footwear: '云履',
};
export const BLUEPRINTS = DAO_EQUIPMENT_SLOTS.flatMap((slot) =>
  EQUIPMENT_LEVELS.map((level) => {
    return {
      id: `blueprint.${slot}.${level}`,
      name: `${getLevelRealmStage(level).realm}${EQUIPMENT_SLOT_NAMES[slot]}图纸`,
      kind: 'blueprint' as const,
      stackLimit: 99,
      slot,
      level,
    };
  }),
);
