import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { SectBuildBuilder } from '../compilation';
import type {
  SectPathCompileContext,
  SectPathDefinition,
  SectPathDefinitionWithoutNodes,
  SectTacticId,
} from '../domain';
import type { SectNodePlugin, SectPathModule } from './contracts';

/**
 * 流派模板方法：定义、节点索引和运行时入口在构造时一次成型。
 * 子类只实现基础变体和战术策略，不参与节点分派。
 */
export abstract class BaseSectPathModule implements SectPathModule {
  readonly definition: SectPathDefinition;
  readonly nodes: ReadonlyMap<string, SectNodePlugin>;

  protected constructor(
    definition: SectPathDefinitionWithoutNodes,
    nodePlugins: readonly SectNodePlugin[],
  ) {
    this.nodes = new Map(
      nodePlugins.map((plugin) => [plugin.definition.id, plugin]),
    );
    this.definition = {
      ...definition,
      nodes: nodePlugins.map((plugin) => plugin.definition),
    };
  }

  abstract compileVariants(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void;

  abstract createSelectionStrategy(
    tacticId: SectTacticId,
  ): AbilitySelectionStrategy;
}
