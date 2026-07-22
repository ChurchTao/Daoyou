import type { CultivatorSectState } from '../../../core';
import { YOUDU_DECREE_PATH_ID, YOUDU_TIDE_PATH_ID } from '../ids';

export type YouduPathId = typeof YOUDU_TIDE_PATH_ID | typeof YOUDU_DECREE_PATH_ID;

export function youduState(
  pathId?: YouduPathId,
  nodes: string[] = [],
  loadout: CultivatorSectState['abilityLoadout'] = [
    'soul-severing-call',
    'forgetful-river-tide',
    'pin-soul',
    'soul-shall-not-return',
  ],
): CultivatorSectState {
  return {
    membershipId: 'youdu-test',
    sectId: 'youdu',
    status: 'active',
    contribution: 30,
    configVersion: 1,
    activePathId: pathId,
    methods: {
      'youdu-canon': 20,
      'three-souls-separation': 20,
      'forgetful-river-record': 20,
      'seven-souls-seizure': 20,
      'soul-pinning-ironbook': 20,
      'dead-heart-living-spirit': 20,
    },
    paths: pathId
      ? [{
          pathId,
          unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
          tacticId: pathId === YOUDU_TIDE_PATH_ID ? 'tide-cycle' : 'pin-the-caster',
          activeMeridianSlot: 1,
          meridianLoadouts: [
            { slot: 1, nodeIds: nodes, version: 1 },
            { slot: 2, nodeIds: [], version: 1 },
            { slot: 3, nodeIds: [], version: 1 },
          ],
        }]
      : [],
    abilityLoadout: loadout,
  };
}

