import { AbilityType } from '@shared/engine/battle-v5/core/types';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import type {
  CultivatorSectPathState,
  ResolvedSectAbility,
  SectAbilityId,
  SectCombatProjection,
  SectCompiledBuild,
  SectDefinition,
  SectProjectionContext,
  SectProjectionInput,
} from '../domain';
import { StandardSectRules } from '../domain';
import type { SectModule } from '../plugin';
import {
  describeSectAbilityConfig,
  projectSectMethodModifiers,
} from '../presentation';
import { isAbilityUnlocked } from '../progression';

function findActivePath(
  context: SectProjectionInput,
): CultivatorSectPathState | undefined {
  return context.sect.paths.find(
    (path) => path.pathId === context.sect.activePathId,
  );
}

/** 统一编排基础宗门、流派变体和节点装饰器流水线。 */
export class SectCompiler {
  compile(module: SectModule, input: SectProjectionInput): SectCompiledBuild {
    const context: SectProjectionContext = {
      ...input,
      methodGrowth: module.methodGrowth,
    };
    const builder = module.createBaseBuilder(context);
    const path = findActivePath(context);
    if (path) {
      const pathModule = module.paths.get(path.pathId);
      if (!pathModule) throw new Error(`流派 ${path.pathId} 未注册运行时模块`);
      pathModule.compile({ ...context, path }, builder);
    }

    const rawBuild = builder.build();
    const build = this.finalizePresentation(module.definition, {
      ...rawBuild,
      abilities: module.methodGrowth.projectAbilities(
        module.definition,
        rawBuild.abilities,
        context.sect.methods,
      ),
    });
    this.assertCombatResourceContract(module.definition, build);
    this.assertDefinitionContracts(module.definition, context, build);
    this.assertAbilityContracts(build);
    return build;
  }

  projectCombat(
    module: SectModule,
    context: SectProjectionInput,
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
          id !== null && isAbilityUnlocked(module.definition, id, context.sect),
      )
      .map((id) => build.abilities[id]?.config)
      .filter((config): config is NonNullable<typeof config> =>
        Boolean(config),
      );
    abilities.push(
      ...Object.entries(build.abilities)
        .filter(([id, ability]) => {
          if (ability.config.type !== AbilityType.PASSIVE_SKILL) return false;
          const definition = module.definition.abilities.find(
            (entry) => entry.id === id,
          );
          return (
            !definition ||
            isAbilityUnlocked(module.definition, id, context.sect)
          );
        })
        .map(([, ability]) => ability.config),
    );
    const defaultDefinition = module.definition.abilities.find(
      (ability) => ability.kind === 'default',
    );
    if (
      !defaultDefinition ||
      !isAbilityUnlocked(module.definition, defaultDefinition.id, context.sect)
    ) {
      throw new Error(`活动宗门 ${module.definition.id} 没有已解锁的默认能力`);
    }
    const defaultAttack = build.abilities[defaultDefinition.id]?.config;
    if (!defaultAttack) {
      throw new Error(
        `活动宗门 ${module.definition.id} 的默认能力缺少编译产物`,
      );
    }
    return {
      defaultAttack,
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
    context: SectProjectionInput & { abilityId: SectAbilityId },
  ): ResolvedSectAbility {
    const definition = module.definition.abilities.find(
      (ability) => ability.id === context.abilityId,
    );
    if (!definition) throw new Error(`未知宗门神通: ${context.abilityId}`);
    const built = this.compile(module, context).abilities[context.abilityId];
    return this.resolveCompiledAbility(module, context, definition, built);
  }

  resolveAbilities(
    module: SectModule,
    context: SectProjectionInput,
  ): ResolvedSectAbility[] {
    const build = this.compile(module, context);
    return module.definition.abilities
      .filter((definition) => Boolean(build.abilities[definition.id]))
      .map((definition) =>
        this.resolveCompiledAbility(
          module,
          context,
          definition,
          build.abilities[definition.id],
        ),
      );
  }

  private resolveCompiledAbility(
    module: SectModule,
    context: SectProjectionInput,
    definition: SectDefinition['abilities'][number],
    built: SectCompiledBuild['abilities'][string] | undefined,
  ): ResolvedSectAbility {
    if (!built) throw new Error(`宗门神通未能投影: ${definition.id}`);
    const unlockRequirements = this.describeUnlock(
      module.definition,
      definition,
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
      unlockRequirements,
      manaCost: built.config.mpCost ?? 0,
      cooldown: built.config.cooldown ?? 0,
      detailRows: built.detailRows,
      notes: built.notes,
      config: built.config,
    };
  }

  private describeUnlock(
    definition: SectDefinition,
    ability: SectDefinition['abilities'][number],
  ): string[] {
    const unlock = ability.unlock;
    switch (unlock.type) {
      case 'always':
        return [];
      case 'active_path': {
        const path = definition.paths.find(
          (entry) => entry.id === unlock.pathId,
        );
        return [`激活${path?.name ?? unlock.pathId}流派`];
      }
      case 'method': {
        const method = definition.methods.find(
          (entry) => entry.id === unlock.methodId,
        );
        return [`${method?.name ?? unlock.methodId}${unlock.level}级`];
      }
    }
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
  }

  private assertDefinitionContracts(
    definition: SectDefinition,
    context: SectProjectionContext,
    build: SectCompiledBuild,
  ): void {
    const path = findActivePath(context);
    const selectedNodeIds = new Set(
      path?.meridianLoadouts.find(
        (loadout) => loadout.slot === path.activeMeridianSlot,
      )?.nodeIds ?? [],
    );
    const definedAbilityIds = new Set(
      definition.abilities.map((ability) => ability.id),
    );
    for (const abilityId of Object.keys(build.abilities)) {
      if (
        !definedAbilityIds.has(abilityId) &&
        !selectedNodeIds.has(abilityId)
      ) {
        throw new Error(`宗门 ${definition.id} 编译出未定义能力 ${abilityId}`);
      }
    }

    for (const ability of definition.abilities) {
      const shouldExist =
        ability.unlock.type !== 'active_path' ||
        ability.unlock.pathId === path?.pathId;
      const compiled = build.abilities[ability.id];
      if (shouldExist && !compiled) {
        throw new Error(`宗门能力 ${ability.id} 缺少编译产物`);
      }
      if (!compiled) continue;
      const passive = compiled.config.type === AbilityType.PASSIVE_SKILL;
      if ((ability.kind === 'passive') !== passive) {
        throw new Error(`宗门能力 ${ability.id} 的定义类型与编译产物不一致`);
      }
    }
  }

  private assertCombatResourceContract(
    definition: SectDefinition,
    build: SectCompiledBuild,
  ): void {
    const expected = definition.combatResource;
    if (build.resources.length !== StandardSectRules.combatResourceCount) {
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
