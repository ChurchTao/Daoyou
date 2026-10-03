import { createTextFilter } from '@daoyou/shared/text-filter';
import dictionary from '@server/config/text-filter.dictionary.json' with { type: 'json' };

// Imported JSON is bundled into dist; invalid dictionaries fail at module startup.
export const textFilter = createTextFilter(dictionary);
