import type { DungeonCostRank } from '../dungeon/cost.js';
import { z } from 'zod';

export const INQUIRY_TEMPLATE_ID = 'inquiry' as const;

export const INQUIRY_CONTAINER_JUDGEMENTS = ['leave_shut', 'open'] as const;

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

export type InquiryContainerJudgement = (typeof INQUIRY_CONTAINER_JUDGEMENTS)[number];
export type InquiryCostType = (typeof INQUIRY_COST_TYPES)[number];
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];
export type InquiryRating = (typeof INQUIRY_RATINGS)[number];

export interface InquiryCostSpec {
  id: string;
  type: Exclude<InquiryCostType, 'battle'>;
  rank: DungeonCostRank;
  /** `{name}` 会换成这件东西在案卷里的名字。 */
  label: string;
  revealsClue: boolean;
  resultText: string;
}

export interface InquiryNpcTopic {
  id: string;
  /** 这些线索都记下之后，这句问话才出现。 */
  needs: string[];
  label: string;
  /** 问出口之后允许玩家看见的原句。不得提前写出答案。 */
  line: string;
}

export interface InquiryNpc {
  id: string;
  locationId: string;
  name: string;
  topics: InquiryNpcTopic[];
}

export interface InquiryHint {
  id: string;
  /** 固定提示。不得写出答案词。 */
  text: string;
}

export interface InquiryPlay {
  id: string;
  startLocationId: string;
  /** 地点、物件、问话和提示的第一眼正文里不得出现这些词。 */
  spoilerTerms: string[];
  locations: Array<{ id: string; name: string }>;
  npcs: InquiryNpc[];
  hints: InquiryHint[];
  objects: Array<{
    id: string;
    locationId: string;
    clueId?: string;
    itemId?: string;
    blocked?: {
      clueId: string;
      itemId?: string;
      pattern: string;
      costs: InquiryCostSpec[];
    };
    container?: {
      pattern: string;
      openText: string;
      battleWonText: string;
    };
    takeAfterOpen?: boolean;
  }>;
  compares: Array<{
    id: string;
    needs: [string, string];
    reveals: string;
    label: string;
  }>;
  clueIds: string[];
  truths: Array<{
    id: string;
    answerId: string;
    containerJudgement: InquiryContainerJudgement;
    containerStartsBattle: boolean;
  }>;
  verdict: {
    requiredClueIds: string[];
    answerLabel: string;
    answers: Array<{ id: string; label: string }>;
    containerLabel: string;
    containerOptions: Array<{ id: InquiryContainerJudgement; label: string }>;
  };
}

export interface InquiryVerdict {
  answerId: string;
  container: InquiryContainerJudgement;
}

export interface InquiryClueText {
  title: string;
  body: string;
  /** 这条线索把哪一个定论选项说成答案。空着表示只是旁证。 */
  assertsAnswer: string | null;
}

export interface InquiryObjectText {
  name: string;
  examineText: string;
}

export interface InquiryDirectorDraft {
  truthId: string;
  cast: Array<{ name: string; relation: string }>;
  truthText: string;
  locations: Record<string, string>;
  clues: Record<string, InquiryClueText>;
  objects: Record<string, InquiryObjectText>;
}

export interface InquiryCaseFile extends InquiryDirectorDraft {
  playId: string;
}

export interface InquiryProgress {
  locationId: string;
  knownClueIds: string[];
  heldItemIds: string[];
  visitedLocationIds: string[];
  inspectedObjectIds: string[];
  unlockedObjectIds: string[];
  openedObjectIds: string[];
  heardTopicIds: string[];
  heardHintIds: string[];
  paidLifespan: boolean;
  foughtContainer: boolean;
  pendingBattle: boolean;
}

const shortText = (max: number) => z.string().trim().min(2).max(max);
const bodyText = (max: number) => z.string().trim().min(8).max(max);

function keyed(ids: string[], schema: z.ZodType) {
  return z.object(Object.fromEntries(ids.map((id) => [id, schema]))).strict();
}

/** The director fills prose into the slots of one play. Slot ids come from that play. */
export function inquiryDirectorSchema(play: InquiryPlay) {
  return z
    .object({
      truthId: z.enum(play.truths.map((truth) => truth.id) as [string, ...string[]]),
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
      locations: keyed(play.locations.map((location) => location.id), bodyText(400)),
      clues: keyed(
        play.clueIds,
        z
          .object({
            title: shortText(24),
            body: bodyText(160),
            assertsAnswer: z
              .enum(play.verdict.answers.map((answer) => answer.id) as [string, ...string[]])
              .nullable(),
          })
          .strict(),
      ),
      objects: keyed(
        play.objects.map((object) => object.id),
        z
          .object({
            name: shortText(20),
            examineText: bodyText(200),
          })
          .strict(),
      ),
    })
    .strict();
}
