import { MaterialFactsSchema } from './definitions/materials';

export function materialFactsOf(data: unknown) {
  return MaterialFactsSchema.parse(data);
}
