import { z } from 'zod';

export const INQUIRY_TEMPLATE_ID = 'cave_inheritance' as const;

export const INQUIRY_LOCATION_IDS = ['mouth', 'hall'] as const;

export const INQUIRY_OBJECT_IDS = [
  'seal_marks',
  'stone_seam',
  'corpse',
  'altar_item',
  'wall_inscription',
  'casket',
] as const;

export const INQUIRY_CLUE_IDS = [
  'outward_seal',
  'altar_script',
  'wall_script',
  'handwriting_diff',
  'corpse_cache',
  'seam_note',
] as const;

export const INQUIRY_ITEM_IDS = [
  'mouth_jade',
  'seam_letter',
  'altar_relic',
] as const;

export const INQUIRY_TRUTH_IDS = ['mouth_cache', 'altar_cache'] as const;

export const INQUIRY_CACHE_IDS = ['mouth_jade', 'altar_item'] as const;

export const INQUIRY_CASKET_JUDGEMENTS = ['leave_shut', 'open'] as const;

/** Costs an inquiry action is allowed to charge. Puzzle items are not costs. */
export const INQUIRY_COST_TYPES = [
  'hp_loss',
  'mp_loss',
  'spirit_stones',
  'lifespan',
  'battle',
] as const;

export const INQUIRY_STATUSES = [
  'PREPARING',
  'INVESTIGATING',
  'IN_BATTLE',
  'SETTLING',
  'FINISHED',
  'FAILED',
] as const;

export const INQUIRY_RATINGS = ['A', 'B'] as const;

export type InquiryTemplateId = typeof INQUIRY_TEMPLATE_ID;
export type InquiryLocationId = (typeof INQUIRY_LOCATION_IDS)[number];
export type InquiryObjectId = (typeof INQUIRY_OBJECT_IDS)[number];
export type InquiryClueId = (typeof INQUIRY_CLUE_IDS)[number];
export type InquiryItemId = (typeof INQUIRY_ITEM_IDS)[number];
export type InquiryTruthId = (typeof INQUIRY_TRUTH_IDS)[number];
export type InquiryCacheId = (typeof INQUIRY_CACHE_IDS)[number];
export type InquiryCasketJudgement = (typeof INQUIRY_CASKET_JUDGEMENTS)[number];
export type InquiryCostType = (typeof INQUIRY_COST_TYPES)[number];
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export type InquiryRating = (typeof INQUIRY_RATINGS)[number];

export interface InquiryVerdict {
  cache: InquiryCacheId;
  casket: InquiryCasketJudgement;
}

export interface InquiryClueText {
  title: string;
  body: string;
  /** Which cache this sentence names as the real one. Null is a supporting fact. */
  assertsCache: InquiryCacheId | null;
}

export interface InquiryObjectText {
  name: string;
  examineText: string;
}

export interface InquiryCaseFile {
  templateId: InquiryTemplateId;
  truthId: InquiryTruthId;
  cast: Array<{ name: string; relation: string }>;
  truthText: string;
  opening: string;
  clues: Record<InquiryClueId, InquiryClueText>;
  objects: Record<InquiryObjectId, InquiryObjectText>;
}

export interface InquiryProgress {
  locationId: InquiryLocationId;
  knownClueIds: InquiryClueId[];
  heldItemIds: InquiryItemId[];
  visitedLocationIds: InquiryLocationId[];
  arraySteadied: boolean;
  seamOpen: boolean;
  casketOpened: boolean;
  foughtCasket: boolean;
  paidLifespan: boolean;
  pendingBattle: boolean;
}

const shortText = (max: number) => z.string().trim().min(2).max(max);
const bodyText = (max: number) => z.string().trim().min(8).max(max);

const clueTextSchema = z
  .object({
    title: shortText(24),
    body: bodyText(160),
    assertsCache: z.enum(INQUIRY_CACHE_IDS).nullable(),
  })
  .strict();

const objectTextSchema = z
  .object({
    name: shortText(20),
    examineText: bodyText(200),
  })
  .strict();

function keyed<T extends readonly string[], S extends z.ZodType>(
  ids: T,
  schema: S,
) {
  return z
    .object(Object.fromEntries(ids.map((id) => [id, schema])) as Record<T[number], S>)
    .strict();
}

/** Director output. Slot ids are fixed; prose and the chosen truth are not. */
export const InquiryDirectorDraftSchema = z
  .object({
    truthId: z.enum(INQUIRY_TRUTH_IDS),
    cast: z
      .array(
        z
          .object({
            name: shortText(20),
            relation: shortText(40),
          })
          .strict(),
      )
      .min(2)
      .max(3),
    truthText: bodyText(400),
    opening: bodyText(400),
    clues: keyed(INQUIRY_CLUE_IDS, clueTextSchema),
    objects: keyed(INQUIRY_OBJECT_IDS, objectTextSchema),
  })
  .strict();

export type InquiryDirectorDraft = z.infer<typeof InquiryDirectorDraftSchema>;
