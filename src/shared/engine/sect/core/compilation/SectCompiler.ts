import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
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
import { projectSectMethodModifiers } from '../presentation';
import { isAbilityUnlocked } from '../progression';

const LAYER_ORDER = new Map<string, number>([
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4],
  ['5', 5],
  ['ultimate', 6],
]);

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
      const orderedNodes = pathModule.definition.nodes
        .filter((node) => selected.has(node.id))
        .sort(
          (left, right) =>
            (LAYER_ORDER.get(String(left.layer)) ?? 99) -
            (LAYER_ORDER.get(String(right.layer)) ?? 99),
        );
      const applied = new Set<string>();
      for (const definition of orderedNodes) {
        const plugin = pathModule.nodes.get(definition.id);
        if (!plugin)
          throw new Error(`经脉节点 ${definition.id} 缺少运行时插件`);
        applied.add(definition.id);
        plugin.apply(
          { ...context, path, activeNodeIds: new Set(applied) },
          builder,
        );
      }
    }

    const build = this.finalizePresentation(module.definition, builder.build());
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
      summary: built.summary ?? definition.description,
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
          const derivedSummary = ability.detailRows.join('；').trim();
          return [
            abilityId,
            {
              ...ability,
              summary:
                ability.summary ??
                (derivedSummary || base?.description || ability.config.name),
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
}
