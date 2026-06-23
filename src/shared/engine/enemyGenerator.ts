import { CreationOrchestrator } from '@shared/engine/creation-v2/CreationOrchestrator';
import { NoopEnemyCopyProvider } from './enemy-generation/EnemyCopyProvider';
import { EnemyBodyCultivationPlanner } from './enemy-generation/EnemyBodyCultivationPlanner';
import { EnemyCraftExecutor } from './enemy-generation/EnemyCraftExecutor';
import { EnemyCultivatorAssembler } from './enemy-generation/EnemyCultivatorAssembler';
import { EnemyGenerationOrchestrator } from './enemy-generation/EnemyGenerationOrchestrator';
import { EnemyLoadoutPlanner } from './enemy-generation/EnemyLoadoutPlanner';
import type {
  EnemyGenerationDraft,
  EnemyGenerationInput,
} from './enemy-generation/types';
import type { EnemyCopyProvider } from './enemy-generation/EnemyCopyProvider';

export type {
  DifficultyBand,
  BodyCultivationTrackLevels,
  EnemyCopyFacts,
  EnemyCopyProductFacts,
  EnemyBodyCultivationPlan,
  EnemyBodyCultivationSummary,
  EnemyDifficultyProfile,
  EnemyGenerationBalanceSnapshot,
  EnemyGenerationDraft,
  EnemyGenerationInput,
  EnemyPersonaDefinition,
  EnemyRaceProfile,
  EnemyLoadoutPlan,
  EnemyPlannedProductIntent,
  NormalizedEnemyGenerationInput,
} from './enemy-generation/types';
export type { EnemyCopyPayload, EnemyCopyProvider } from './enemy-generation/EnemyCopyProvider';
export { NoopEnemyCopyProvider } from './enemy-generation/EnemyCopyProvider';
export { EnemyBodyCultivationPlanner } from './enemy-generation/EnemyBodyCultivationPlanner';
export { EnemyCraftExecutor } from './enemy-generation/EnemyCraftExecutor';
export { EnemyGenerationOrchestrator } from './enemy-generation/EnemyGenerationOrchestrator';
export { EnemyLoadoutPlanner } from './enemy-generation/EnemyLoadoutPlanner';

interface EnemyGeneratorDeps {
  creationOrchestrator?: CreationOrchestrator;
  loadoutPlanner?: EnemyLoadoutPlanner;
  bodyCultivationPlanner?: EnemyBodyCultivationPlanner;
  craftExecutor?: EnemyCraftExecutor;
  cultivatorAssembler?: EnemyCultivatorAssembler;
  copyProvider?: EnemyCopyProvider;
  orchestrator?: EnemyGenerationOrchestrator;
}

export class EnemyGenerator {
  private readonly orchestrator: EnemyGenerationOrchestrator;

  constructor(deps: EnemyGeneratorDeps = {}) {
    this.orchestrator =
      deps.orchestrator ??
      new EnemyGenerationOrchestrator(
        deps.loadoutPlanner ?? new EnemyLoadoutPlanner(),
        deps.craftExecutor ??
          new EnemyCraftExecutor(
            deps.creationOrchestrator ?? new CreationOrchestrator(),
          ),
        deps.cultivatorAssembler ?? new EnemyCultivatorAssembler(),
        deps.copyProvider ?? new NoopEnemyCopyProvider(),
        deps.bodyCultivationPlanner ?? new EnemyBodyCultivationPlanner(),
      );
  }

  buildDraft(input: EnemyGenerationInput): EnemyGenerationDraft {
    return this.orchestrator.buildDraft(input);
  }

  async enrichNarrative(
    draft: EnemyGenerationDraft,
  ): Promise<EnemyGenerationDraft> {
    return this.orchestrator.enrichNarrative(draft);
  }
}

export const enemyGenerator = new EnemyGenerator();
