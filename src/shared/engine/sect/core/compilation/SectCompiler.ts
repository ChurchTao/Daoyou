import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { standardSectMethodGrowthPolicy } from '../authoring';
import type {
  CultivatorSectPathState,
  ResolvedSectAbility,
  SectAbilityId,
  SectCombatProjection,
  SectCompiledBuild,
  SectDefinition,
  SectProjectionContext,
} from '../domain';
import type { SectModule } from '../plugin';
import {
  describeSectAbilityConfig,
  projectSectMethodModifiers,
} from '../presentation';
import { isAbilityUnlocked } from '../progression';

function findActivePath(
  context: SectProjectionContext,
): CultivatorSectPathState | undefined {
  return context.sect.paths.find(
    (path) => path.pathId === context.sect.activePathId,
  );
}

function selectedNodeIds(path: CultivatorSectPathState): string[] {
  return (
    path.meridianLoadouts.find(
      (loadout) => loadout.slot === path.activeMeridianSlot,
    )?.nodeIds ?? []
  );
}

/** 统一编排基础宗门、流派变体和节点装饰器流水线。 */
export class SectCompiler {
  compile(
    module: SectModule,
    context: SectProjectionContext,
  ): SectCompiledBuild {
    const builder = module.createBaseBuilder(context);
    const path = findActivePath(context);
    if (path) {
      const pathModule = module.paths.get(path.pathId);
      if (!pathModule) throw new Error(`流派 ${path.pathId} 未注册运行时模块`);
      pathModule.compileVariants({ ...context, path }, builder);

      const selected = new Set(selectedNodeIds(path));
      const unlocked = new Set(path.unlockedLayerIds);
      const layerOrder = new Map(
        pathModule.definition.layers.map((layer) => [layer.id, layer.order]),
      );
      const orderedNodes = pathModule.definition.nodes
        .filter((node) => selected.has(node.id) && unlocked.has(node.layerId))
        .sort(
          (left, right) =>
            (layerOrder.get(left.layerId) ?? 99) -
            (layerOrder.get(right.layerId) ?? 99),
        );
      const applied = new Set<string>();
      for (const definition of orderedNodes) {
        const plugin = pathModule.nodes.get(definition.id);
        if (!plugin)
          throw new Error(`参悟节点 ${definition.id} 缺少运行时插件`);
        applied.add(definition.id);
        plugin.apply(
          { ...context, path, activeNodeIds: new Set(applied) },
          builder,
        );
      }
    }

    const rawBuild = builder.build();
    const build = this.finalizePresentation(module.definition, {
      ...rawBuild,
      abilities: standardSectMethodGrowthPolicy.projectAbilities(
        module.definition,
        rawBuild.abilities,
        context.sect.methods,
      ),
      passives: standardSectMethodGrowthPolicy.projectPassives(
        rawBuild.passives,
        context.sect.methods,
      ),
    });
    this.assertCombatResourceContract(module.definition, build);
    this.assertAbilityContracts(build);
    return build;
  }

  projectCombat(
    module: SectModule,
    context: SectProjectionContext,
  ): SectCombatProjection | null {
    if (
      context.sect.status !== 'active' ||
      context.sect.sectId !== module.definition.id
    ) {
      return null;
    }
    const build = this.compile(module, context);
    const path = findActivePath(context);
    const pathModule = path ? module.paths.get(path.pathId) : undefined;
    const abilities = context.sect.abilityLoadout
      .filter(
        (id): id is string =>
          id !== null &&
          id !== build.defaultAbilityId &&
          isAbilityUnlocked(module.definition, id, context.sect),
      )
      .map((id) => build.abilities[id]?.config)
      .filter((config): config is NonNullable<typeof config> =>
        Boolean(config),
      );
    abilities.push(...build.passives);
    return {
      defaultAttack: build.abilities[build.defaultAbilityId]?.config,
      abilities,
      methodModifiers: projectSectMethodModifiers(
        context.sect,
        module.definition,
      ),
      resources: build.resources,
      selectionStrategy:
        path && pathModule
          ? pathModule.createSelectionStrategy(path.tacticId)
          : undefined,
    };
  }

  resolveAbility(
    module: SectModule,
    context: SectProjectionContext & { abilityId: SectAbilityId },
  ): ResolvedSectAbility {
    const definition = module.definition.abilities.find(
      (ability) => ability.id === context.abilityId,
    );
    if (!definition) throw new Error(`未知宗门神通: ${context.abilityId}`);
    const built = this.compile(module, context).abilities[context.abilityId];
    if (!built) throw new Error(`宗门神通未能投影: ${context.abilityId}`);
    const method = module.definition.methods.find(
      (entry) => entry.id === definition.methodId,
    );
    return {
      id: definition.id,
      name: built.config.name,
      baseName: definition.baseName,
      role: definition.role,
      summary: definition.description,
      unlocked: isAbilityUnlocked(
        module.definition,
        definition.id,
        context.sect,
      ),
      unlockRequirements: [
        `${method?.name ?? definition.methodId}${definition.unlockLevel}级`,
      ],
      manaCost: built.config.mpCost ?? 0,
      cooldown: built.config.cooldown ?? 0,
      detailRows: built.detailRows,
      notes: built.notes,
      config: built.config,
    };
  }

  private finalizePresentation(
    definition: SectDefinition,
    build: SectCompiledBuild,
  ): SectCompiledBuild {
    return {
      ...build,
      abilities: Object.fromEntries(
        Object.entries(build.abilities).map(([abilityId, ability]) => {
          const base = definition.abilities.find(
            (entry) => entry.id === abilityId,
          );
          const configFacts = describeSectAbilityConfig(
            ability.config,
            build.resources,
          );
          const modifierFacts = (build.abilityPresentationModifiers ?? [])
            .filter((modifier) => modifier.abilityId === abilityId)
            .flatMap((modifier) => modifier.factRows);
          const detailRows = Array.from(
            new Set([...configFacts, ...modifierFacts].filter(Boolean)),
          );
          return [
            abilityId,
            {
              ...ability,
              detailRows,
              summary:
                base?.description ?? ability.summary ?? ability.config.name,
            },
          ];
        }),
      ),
    };
  }

  private assertAbilityContracts(build: SectCompiledBuild): void {
    for (const ability of Object.values(build.abilities)) {
      AbilityFactory.create(ability.config);
    }
    for (const passive of build.passives) AbilityFactory.create(passive);
  }

  private assertCombatResourceContract(
    definition: SectDefinition,
    build: SectCompiledBuild,
  ): void {
    const expected = definition.combatResource;
    if (build.resources.length !== 1) {
      throw new Error(
        `宗门 ${definition.id} 编译结果必须且只能包含一个战斗资源`,
      );
    }
    const actual = build.resources[0];
    if (
      actual.id !== expected.id ||
      actual.name !== expected.name ||
      actual.icon !== expected.icon ||
      actual.max !== expected.max
    ) {
      throw new Error(
        `宗门 ${definition.id} 流派不得修改战斗资源ID、名称、图标或上限`,
      );
    }
  }
}
