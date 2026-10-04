import {
  EQUIPMENT_SLOT_NAMES,
  EQUIPMENT_LEVELS,
  DAO_EQUIPMENT_SLOTS,
} from '@daoyou/game-domain/equipment';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';



export const BLUEPRINTS = DAO_EQUIPMENT_SLOTS.flatMap((slot) =>
  EQUIPMENT_LEVELS.map((level) => {
    return {
      id: `blueprint.${slot}.${level}`,
      name: `${getLevelRealmStage(level).realm}期${EQUIPMENT_SLOT_NAMES[slot]}`,
      kind: 'blueprint' as const,
      stackLimit: 99,
      slot,
      level,
    };
  }),
);
