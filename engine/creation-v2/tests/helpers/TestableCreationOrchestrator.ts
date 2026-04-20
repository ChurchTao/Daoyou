import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { CreationSession } from '@/engine/creation-v2/CreationSession';
import type {
  AffixCandidate,
  CreationBlueprint,
  CreationIntent,
  EnergyBudget,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '@/engine/creation-v2/types';

export class TestableCreationOrchestrator extends CreationOrchestrator {
  public analyzeMaterialsWithDefaults(session: CreationSession): MaterialFingerprint[] {
    return super.analyzeMaterialsWithDefaults(session);
  }

  public async analyzeMaterialsWithDefaultsAsync(
    session: CreationSession,
  ): Promise<MaterialFingerprint[]> {
    return super.analyzeMaterialsWithDefaultsAsync(session);
  }

  public resolveIntentWithDefaults(session: CreationSession): CreationIntent {
    return super.resolveIntentWithDefaults(session);
  }

  public validateRecipeWithDefaults(session: CreationSession): RecipeMatch {
    return super.validateRecipeWithDefaults(session);
  }

  public budgetEnergyWithDefaults(session: CreationSession): EnergyBudget {
    return super.budgetEnergyWithDefaults(session);
  }

  public buildAffixPoolWithDefaults(session: CreationSession): AffixCandidate[] {
    return super.buildAffixPoolWithDefaults(session);
  }

  public rollAffixesWithDefaults(session: CreationSession): RolledAffix[] {
    return super.rollAffixesWithDefaults(session);
  }

  public composeBlueprintWithDefaults(session: CreationSession): CreationBlueprint {
    return super.composeBlueprintWithDefaults(session);
  }
}
