import { MaterialFactsSchema } from './material-facts.js';

export function materialFactsOf(data: unknown) {
  return MaterialFactsSchema.parse(data);
}
