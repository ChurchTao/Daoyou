import { SectCompiler } from './compiler';
import { createSectRegistry, type SectRegistry } from './registry';
import type { CultivatorSectState, ResolvedSectAbility, SectCombatProjection, SectModule } from './types';
import type { RealmType } from '@shared/types/constants';

export interface SectRuntime {
  registry: SectRegistry;
  compiler: SectCompiler;
  projectCombat(args: { sect: CultivatorSectState; realm: RealmType }): SectCombatProjection | null;
  resolveAbility(args: { sect: CultivatorSectState; realm: RealmType; abilityId: string }): ResolvedSectAbility;
  validateState(state: CultivatorSectState): void;
}

export function createSectRuntime(modules: readonly SectModule[]): SectRuntime {
  const registry = createSectRegistry(modules);
  const compiler = new SectCompiler();
  return {
    registry,
    compiler,
    projectCombat(args) {
      registry.validateState(args.sect);
      return compiler.projectCombat(registry.require(args.sect.sectId), args);
    },
    resolveAbility(args) {
      registry.validateState(args.sect);
      return compiler.resolveAbility(registry.require(args.sect.sectId), args);
    },
    validateState(state) { registry.validateState(state); },
  };
}

