import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { createSectNodeContribution } from './compiler';
import type {
  CultivatorSectPathState,
  SectCompiledBuild,
  SectNodeBehavior,
  SectPathDefinition,
  SectPathModule,
  SectProjectionContext,
  SectTacticId,
} from './types';

/**
 * Template Method for deterministic path plugins.
 *
 * A path author implements one pure snapshot compiler. The template converts
 * every selected node snapshot into controlled `SectNodeContribution`
 * operations, so nodes cannot mutate the shared build outside the compiler.
 */
export abstract class DeterministicSectPathModule implements SectPathModule {
  readonly nodeBehaviors: Record<string, SectNodeBehavior>;

  protected constructor(readonly definition: SectPathDefinition) {
    this.nodeBehaviors = Object.fromEntries(
      definition.nodes.map((node) => [
        node.id,
        this.createNodeBehavior(node.id),
      ]),
    );
  }

  compileVariants(
    context: SectProjectionContext & { path: CultivatorSectPathState },
    base: SectCompiledBuild,
  ): SectCompiledBuild {
    return this.compilePath(context, base, new Set());
  }

  abstract createSelectionStrategy(
    tacticId: SectTacticId,
  ): AbilitySelectionStrategy;

  protected abstract compilePath(
    context: SectProjectionContext & { path: CultivatorSectPathState },
    base: Readonly<SectCompiledBuild>,
    activeNodeIds: ReadonlySet<string>,
  ): SectCompiledBuild;

  private createNodeBehavior(nodeId: string): SectNodeBehavior {
    return {
      contribute: (context, currentBuild) => {
        if (!context.activeNodeIds.has(nodeId)) {
          throw new Error(`节点 ${nodeId} 未进入编译上下文`);
        }
        const desired = this.compilePath(
          context,
          context.sectBaseBuild,
          context.activeNodeIds,
        );
        return createSectNodeContribution(currentBuild, desired);
      },
    };
  }
}
