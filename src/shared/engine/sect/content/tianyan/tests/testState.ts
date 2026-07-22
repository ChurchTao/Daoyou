import type { CultivatorSectState } from '../../../core';
import {
  TIANYAN_HETU_PATH_ID,
  TIANYAN_LUOSHU_PATH_ID,
} from '../ids';

export type TianyanPathId =
  | typeof TIANYAN_HETU_PATH_ID
  | typeof TIANYAN_LUOSHU_PATH_ID;

export function tianyanState(
  pathId?: TianyanPathId,
  nodes: string[] = [],
): CultivatorSectState {
  return {
    membershipId: 'tianyan-test',
    sectId: 'tianyan',
    status: 'active',
    contribution: 30,
    configVersion: 1,
    activePathId: pathId,
    methods: {
      'tianyan-canon': 20,
      'wood-vitality': 10,
      'fire-illumination': 10,
      'earth-bearing': 10,
      'metal-severing': 10,
      'water-flowing': 10,
    },
    paths: pathId
      ? [
          {
            pathId,
            unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
            tacticId:
              pathId === TIANYAN_HETU_PATH_ID
                ? 'small-cycle'
                : 'break-pattern',
            activeMeridianSlot: 1,
            meridianLoadouts: [
              { slot: 1, nodeIds: nodes, version: 1 },
              { slot: 2, nodeIds: [], version: 1 },
              { slot: 3, nodeIds: [], version: 1 },
            ],
          },
        ]
      : [],
    abilityLoadout: [
      'verdant-pulse',
      'flowing-flame',
      'dark-water-return',
      'shift-palace',
    ],
  };
}
