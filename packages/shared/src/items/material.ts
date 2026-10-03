import { MaterialFactsSchema } from './definitions/materials.js';

export function materialFactsOf(data: unknown) {
  return MaterialFactsSchema.parse(data);
}
