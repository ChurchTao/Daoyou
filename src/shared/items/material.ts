import { MaterialFactsSchema } from './definitions/materials';
import { findItemDefinition } from './registry';

export function materialFactsOf(definitionId: string, data: unknown) {
  return MaterialFactsSchema.parse(
    findItemDefinition(definitionId)?.material ?? data,
  );
}
