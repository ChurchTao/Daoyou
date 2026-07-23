import type { SectCompiledAbility } from './compilation';
import type { SectDefinition, SectMethodId } from './definitions';

export interface SectMethodGrowthPolicy {
  growCount(baseCount: number, rawLevel: number | undefined): number;
  projectAbilities(
    definition: SectDefinition,
    abilities: Record<string, SectCompiledAbility>,
    methodLevels: Partial<Record<SectMethodId, number>>,
  ): Record<string, SectCompiledAbility>;
}

