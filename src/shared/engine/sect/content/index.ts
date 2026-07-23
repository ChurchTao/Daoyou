import type { RealmType } from '@shared/types/constants';
import {
  CultivatorSectPathState,
  CultivatorSectState,
  ResolvedSectPathPreview,
  isListedSectAbility,
} from '../core';
import { productionSectRuntime } from './productionRuntime';

export {
  PRODUCTION_SECTS,
  PRODUCTION_SECT_IDS,
  PRODUCTION_SECT_PRESENTATIONS,
  createProductionSectCatalog,
  productionSectRuntime,
  sectRegistry,
  type ProductionSectEntry,
} from './productionRuntime';

export const projectSectCombat = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
}) => productionSectRuntime.projectCombat(args);

export const resolveSectAbility = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
  abilityId: string;
}) => productionSectRuntime.resolveAbility(args);

export const resolveSectAbilities = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
}) => productionSectRuntime.resolveAbilities(args);

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
  const sectModule = productionSectRuntime.registry.require(args.sect.sectId);
  const definition = sectModule.definition;
  const path = definition.paths.find((entry) => entry.id === args.pathId);
  if (!path) throw new Error(`未知宗门流派: ${args.pathId}`);
  const pathModule = sectModule.paths.get(path.id);
  if (!pathModule) throw new Error(`未知宗门流派模块: ${args.pathId}`);
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
    nodes: path.nodes.map((node) => {
      const plugin = pathModule.nodes.get(node.id);
      return {
        id: node.id,
        name: node.name,
        description:
          plugin?.describe?.({ sect: args.sect, realm: args.realm }) ??
          node.description,
      };
    }),
    abilities: (() => {
      const baselineById = new Map(
        productionSectRuntime
          .resolveAbilities({ sect: baselineState, realm: args.realm })
          .map((ability) => [ability.id, ability]),
      );
      const pathBaseById = new Map(
        productionSectRuntime
          .resolveAbilities({ sect: pathBaseState, realm: args.realm })
          .map((ability) => [ability.id, ability]),
      );
      const currentById = currentState
        ? new Map(
            productionSectRuntime
              .resolveAbilities({ sect: currentState, realm: args.realm })
              .map((ability) => [ability.id, ability]),
          )
        : undefined;
      return definition.abilities.filter(isListedSectAbility).map((ability) => {
        const baseline = baselineById.get(ability.id)!;
        const pathBase = pathBaseById.get(ability.id)!;
        const current = currentById?.get(ability.id);
        return {
          id: ability.id,
          name: ability.baseName,
          summary: ability.description,
          changeSummary:
            path.presentation?.abilityChanges[ability.id] ??
            '查看流派效果变化。',
          unlocked: pathBase.unlocked,
          unlockRequirements: pathBase.unlockRequirements,
          baseline,
          pathBase,
          current,
        };
      });
    })(),
  };
};
