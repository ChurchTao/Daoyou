import dictionary from '@server/config/text-filter.dictionary.json';
import { createTextFilter } from '@shared/text-filter';

// Imported JSON is bundled into dist; invalid dictionaries fail at module startup.
export const textFilter = createTextFilter(dictionary);
