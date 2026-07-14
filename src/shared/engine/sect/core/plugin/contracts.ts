import type { AbilitySelectionStrategy } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import type { SectBuildBuilder } from '../compilation';
import type {
  SectAdmissionContext,
  SectAdmissionResult,
  SectDefinition,
  SectNodeApplyContext,
  SectPathCompileContext,
  SectPathDefinition,
  SectProjectionContext,
  SectTacticId,
  SectTrialContext,
  SectTrialScenario,
} from '../domain';

export interface SectNodePlugin {
  readonly definition: import('../domain').SectMeridianNodeDefinition;
  apply(context: SectNodeApplyContext, builder: SectBuildBuilder): void;
}

export interface SectPathModule {
  readonly definition: SectPathDefinition;
  readonly nodes: ReadonlyMap<string, SectNodePlugin>;
  compileVariants(
    context: SectPathCompileContext,
    builder: SectBuildBuilder,
  ): void;
  createSelectionStrategy(tacticId: SectTacticId): AbilitySelectionStrategy;
}

export interface SectAdmissionPolicy {
  check(context: SectAdmissionContext): SectAdmissionResult;
}

export interface SectTrialScenarioFactory {
  create(context: SectTrialContext): SectTrialScenario;
}

export interface SectModule {
  readonly definition: SectDefinition;
  readonly paths: ReadonlyMap<string, SectPathModule>;
  createBaseBuilder(context: SectProjectionContext): SectBuildBuilder;
  checkAdmission(context: SectAdmissionContext): SectAdmissionResult;
  createTrialScenario(context: SectTrialContext): SectTrialScenario;
}
