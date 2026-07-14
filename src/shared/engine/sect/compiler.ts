import { projectSectMethodModifiers } from './methodModifiers';
import { isAbilityUnlocked } from './progression';
import type {
  CultivatorSectPathState,
  ResolvedSectAbility,
  SectAbilityId,
  SectCombatProjection,
  SectCompiledBuild,
  SectDefinition,
  SectModule,
  SectNodeContribution,
  SectProjectionContext,
} from './types';

const LAYER_ORDER = new Map<string, number>([
  ['1', 1],
  ['2', 2],
  ['3', 3],
  ['4', 4],
  ['5', 5],
  ['ultimate', 6],
]);

function activePath(
  context: SectProjectionContext,
): CultivatorSectPathState | undefined {
  return context.sect.paths.find(
    (path) => path.pathId === context.sect.activePathId,
  );
}

function activeNodeIds(path: CultivatorSectPathState | undefined): string[] {
  if (!path) return [];
  return (
    path.meridianLoadouts.find(
      (loadout) => loadout.slot === path.activeMeridianSlot,
    )?.nodeIds ?? []
  );
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Converts a content compiler's desired build into the small, controlled set of
 * operations that a meridian node is allowed to contribute.
 */
export function createSectNodeContribution(
  current: Readonly<SectCompiledBuild>,
  desired: Readonly<SectCompiledBuild>,
): SectNodeContribution {
  const operations: SectNodeContribution['operations'] = [];
  if (current.defaultAbilityId !== desired.defaultAbilityId) {
    operations.push({
      type: 'set_default_ability',
      abilityId: desired.defaultAbilityId,
    });
  }
  for (const [abilityId, ability] of Object.entries(desired.abilities)) {
    if (!sameValue(current.abilities[abilityId], ability)) {
      operations.push({ type: 'set_ability', abilityId, ability });
    }
  }
  if (!sameValue(current.resources, desired.resources)) {
    operations.push({ type: 'set_resources', resources: desired.resources });
  }
  if (!sameValue(current.passives, desired.passives)) {
    operations.push({ type: 'set_passives', passives: desired.passives });
  }
  return { operations };
}

function applyContribution(
  build: SectCompiledBuild,
  contribution: SectNodeContribution,
): SectCompiledBuild {
  let next = build;
  for (const operation of contribution.operations) {
    switch (operation.type) {
      case 'set_default_ability':
        next = { ...next, defaultAbilityId: operation.abilityId };
        break;
      case 'set_ability':
        next = {
          ...next,
          abilities: {
            ...next.abilities,
            [operation.abilityId]: operation.ability,
          },
        };
        break;
      case 'set_resources':
        next = { ...next, resources: operation.resources };
        break;
      case 'set_passives':
        next = { ...next, passives: operation.passives };
        break;
    }
  }
  return next;
}

export class SectCompiler {
  compile(
    module: SectModule,
    context: SectProjectionContext,
  ): SectCompiledBuild {
    const sectBaseBuild = module.compileBase(context);
    let build = sectBaseBuild;
    const path = activePath(context);
    if (!path) return this.finalizePresentation(module.definition, build);
    const pathModule = module.paths[path.pathId];
    if (!pathModule) throw new Error(`流派 ${path.pathId} 未注册运行时模块`);

    build = pathModule.compileVariants({ ...context, path }, build);
    const selected = new Set(activeNodeIds(path));
    const orderedNodes = pathModule.definition.nodes
      .filter((node) => selected.has(node.id))
      .sort(
        (a, b) =>
          (LAYER_ORDER.get(String(a.layer)) ?? 99) -
          (LAYER_ORDER.get(String(b.layer)) ?? 99),
      );
    const applied = new Set<string>();
    for (const node of orderedNodes) {
      applied.add(node.id);
      const behavior = pathModule.nodeBehaviors[node.id];
      if (!behavior) throw new Error(`经脉节点 ${node.id} 缺少运行时行为`);
      const contribution = behavior.contribute(
        { ...context, path, sectBaseBuild, activeNodeIds: applied },
        build,
      );
      if (!contribution.operations.length)
        throw new Error(`经脉节点 ${node.id} 的运行时贡献为空`);
      build = applyContribution(build, contribution);
    }
    return this.finalizePresentation(module.definition, build);
  }

  projectCombat(
    module: SectModule,
    context: SectProjectionContext,
  ): SectCombatProjection | null {
    if (
      context.sect.status !== 'active' ||
      context.sect.sectId !== module.definition.id
    )
      return null;
    const build = this.compile(module, context);
    const path = activePath(context);
    const pathModule = path ? module.paths[path.pathId] : undefined;
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
}
