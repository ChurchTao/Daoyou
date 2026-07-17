import type { RealmType } from '@shared/types/constants';
import type {
  CultivatorSectPathState,
  CultivatorSectState,
  ResolvedSectPathPreview,
} from '../core';
import { productionSectRuntime } from './productionRuntime';

export { productionSectRuntime, sectRegistry } from './productionRuntime';

export const projectSectCombat = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
}) => productionSectRuntime.projectCombat(args);

export const resolveSectAbility = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
  abilityId: string;
}) => productionSectRuntime.resolveAbility(args);

function emptyPathState(
  pathId: string,
  defaultTacticId: string,
): CultivatorSectPathState {
  return {
    pathId,
    unlockedLayerIds: [],
    tacticId: defaultTacticId,
    activeMeridianSlot: 1,
    meridianLoadouts: [
      { slot: 1, nodeIds: [], version: 1 },
      { slot: 2, nodeIds: [], version: 1 },
      { slot: 3, nodeIds: [], version: 1 },
    ],
  };
}

export const resolveSectPathPreview = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
  pathId: string;
}): ResolvedSectPathPreview => {
  const definition = productionSectRuntime.registry.require(
    args.sect.sectId,
  ).definition;
  const path = definition.paths.find((entry) => entry.id === args.pathId);
  if (!path) throw new Error(`未知宗门流派: ${args.pathId}`);
  const learnedPath = args.sect.paths.find(
    (entry) => entry.pathId === args.pathId,
  );

  const baselineState = structuredClone(args.sect);
  baselineState.activePathId = undefined;

  const pathBaseState = structuredClone(args.sect);
  pathBaseState.activePathId = path.id;
  const pathBaseProgress = pathBaseState.paths.find(
    (entry) => entry.pathId === path.id,
  );
  if (pathBaseProgress) {
    pathBaseProgress.meridianLoadouts = pathBaseProgress.meridianLoadouts.map(
      (loadout) => ({ ...loadout, nodeIds: [] }),
    );
  } else {
    pathBaseState.paths.push(emptyPathState(path.id, path.defaultTacticId));
  }

  const currentState = learnedPath ? structuredClone(args.sect) : undefined;
  if (currentState) currentState.activePathId = path.id;

  return {
    pathId: path.id,
    learned: Boolean(learnedPath),
    active: args.sect.activePathId === path.id,
    activeMeridianSlot: learnedPath?.activeMeridianSlot,
    abilities: definition.abilities.map((ability) => {
      const baseline = productionSectRuntime.resolveAbility({
        sect: baselineState,
        realm: args.realm,
        abilityId: ability.id,
      });
      const pathBase = productionSectRuntime.resolveAbility({
        sect: pathBaseState,
        realm: args.realm,
        abilityId: ability.id,
      });
      const current = currentState
        ? productionSectRuntime.resolveAbility({
            sect: currentState,
            realm: args.realm,
            abilityId: ability.id,
          })
        : undefined;
      return {
        id: ability.id,
        name: ability.baseName,
        summary: ability.description,
        changeSummary:
          path.presentation?.abilityChanges[ability.id] ?? '查看流派效果变化。',
        unlocked: pathBase.unlocked,
        unlockRequirements: pathBase.unlockRequirements,
        baseline,
        pathBase,
        current,
      };
    }),
  };
};
