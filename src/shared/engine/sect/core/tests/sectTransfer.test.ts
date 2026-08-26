import {
  buildSectTransferPlan,
  type CultivatorSectState,
  type SectDefinition,
} from '..';
import {
  PRODUCTION_SECTS,
  productionSectRuntime,
} from '../../content/productionRuntime';

function progressedState(definition: SectDefinition): CultivatorSectState {
  return {
    membershipId: 'source-membership',
    sectId: definition.id,
    status: 'active',
    activePathId: definition.paths[0]!.id,
    contribution: 880,
    lifetimeContribution: 4_200,
    discipleRank: 'inner',
    office: 'steward',
    configVersion: definition.configVersion,
    methods: Object.fromEntries(
      [...definition.methods]
        .sort((left, right) => left.slot - right.slot)
        .map((method, index) => [method.id, (index + 1) * 20]),
    ),
    paths: definition.paths.map((path, index) => ({
      pathId: path.id,
      unlockedLayerIds: [...path.layers]
        .sort((left, right) => left.order - right.order)
        .slice(0, index === 0 ? 5 : 3)
        .map((layer) => layer.id),
      tacticId: path.defaultTacticId,
      activeMeridianSlot: 2,
      meridianLoadouts: [
        { slot: 1, nodeIds: [path.nodes[0]!.id], version: 3 },
        { slot: 2, nodeIds: [path.nodes[1]!.id], version: 4 },
        { slot: 3, nodeIds: [], version: 2 },
      ],
    })),
    abilityLoadout: [null, null, null, null],
  };
}

describe('欺天符标准宗门玉牒改写规划', () => {
  const definitions = PRODUCTION_SECTS.map((entry) => entry.module.definition);

  it.each(
    definitions.flatMap((source) =>
      definitions
        .filter((target) => target.id !== source.id)
        .map((target) => [source, target] as const),
    ),
  )('$id 可以以欺天符改写至其他生产宗门', (source, target) => {
    const plan = buildSectTransferPlan({
      source: progressedState(source),
      sourceDefinition: source,
      targetDefinition: target,
    });

    expect(plan.methodLevels.map((entry) => entry.level)).toEqual([
      20, 40, 60, 80, 100, 120,
    ]);
    expect(plan.pathMappings.map((entry) => entry.unlockedLayerCount)).toEqual([
      5, 3,
    ]);
    expect(
      plan.targetPaths.map((path) => path.unlockedLayerIds.length),
    ).toEqual([5, 3]);
    expect(
      plan.targetPaths.every((path) =>
        path.meridianLoadouts.every((loadout) => loadout.nodeIds.length === 0),
      ),
    ).toBe(true);
    expect(plan.activePathId).toBe(target.paths[0]!.id);
    expect(() =>
      productionSectRuntime.validateState({
        membershipId: 'target-membership',
        sectId: target.id,
        status: 'active',
        activePathId: plan.activePathId,
        contribution: 880,
        lifetimeContribution: 4_200,
        discipleRank: 'inner',
        office: 'none',
        configVersion: target.configVersion,
        methods: Object.fromEntries(
          plan.methodLevels.map((method) => [
            method.targetMethodId,
            method.level,
          ]),
        ),
        paths: plan.targetPaths,
        abilityLoadout: [null, null, null, null],
      }),
    ).not.toThrow();
  });

  it('允许交换两条道途的伪装对应关系', () => {
    const source = definitions[0]!;
    const target = definitions[4]!;
    const plan = buildSectTransferPlan({
      source: progressedState(source),
      sourceDefinition: source,
      targetDefinition: target,
      reversePathMapping: true,
    });

    expect(plan.pathMappings[0]!.targetPathId).toBe(target.paths[1]!.id);
    expect(plan.pathMappings[1]!.targetPathId).toBe(target.paths[0]!.id);
    expect(plan.activePathId).toBe(target.paths[1]!.id);
  });

  it('拒绝以欺天符改写为当前宗门', () => {
    const definition = definitions[0]!;
    expect(() =>
      buildSectTransferPlan({
        source: progressedState(definition),
        sourceDefinition: definition,
        targetDefinition: definition,
      }),
    ).toThrow('不能以欺天符改写为当前宗门');
  });
});
