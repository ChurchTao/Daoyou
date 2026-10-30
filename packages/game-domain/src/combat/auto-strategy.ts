import { z } from 'zod';


export const MAX_AUTO_STRATEGY_RULES = 10;

const comparison = z.enum(['lt', 'lte', 'gt', 'gte']);

export type AutoComparison = z.infer<typeof comparison>;


const condition = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('selfHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('allyHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('enemyHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({ type: z.literal('allyDowned') }),
  z.strictObject({
    type: z.literal('targetHpBelow'),
    percent: z.number().int().min(1).max(100),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('enemyCountAtLeast'),
    count: z.number().int().min(1).max(6),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('selfResourceAtLeast'),
    resourceId: z.string().min(1).max(120),
    amount: z.number().int().min(0).max(10000),
    comparison: comparison.optional(),
  }),
  z.strictObject({
    type: z.literal('selfStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('targetStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
    ownedBySelf: z.boolean(),
  }),
  z.strictObject({
    type: z.literal('allyStatus'),
    kind: z.string().min(1).max(120),
    statusId: z.string().min(1).max(160).optional(),
    present: z.boolean(),
    ownedBySelf: z.boolean(),
  }),
]);


const rule = z.strictObject({
  conditions: z.array(condition).max(3),
  action: z.discriminatedUnion('type', [
    z.strictObject({
      type: z.literal('skill'),
      skillId: z.string().min(1).max(160),
    }),
    z.strictObject({ type: z.literal('attack') }),
    z.strictObject({ type: z.literal('defend') }),
  ]),
  target: z.enum(['best', 'lowestHpEnemy', 'lowestHpAlly']).default('best'),
  targetScope: z.enum(['any', 'allyPet', 'ownPet', 'teammatePlayer']).optional(),
});

// Existing saved and in-progress battles may still contain 11–12 rules.
export const AutoStrategySchema = z.strictObject({
  version: z.literal(1),
  rules: z.array(rule).max(12),
});

export const SaveAutoStrategySchema = z.strictObject({
  version: z.literal(1),
  rules: z.array(rule).max(MAX_AUTO_STRATEGY_RULES),
});

export const MAX_AUTO_STRATEGY_SLOTS = 3;

export const AUTO_STRATEGY_SLOT_LABELS = ['战术一', '战术二', '战术三'] as const;

export const AutoStrategySlotIndexSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

const storedSlot = AutoStrategySchema.nullable();

// `slots` distinguishes this document from a legacy single AutoStrategy.
export const AutoStrategyBookSchema = z.strictObject({
  version: z.literal(1),
  activeSlot: z.union([AutoStrategySlotIndexSchema, z.null()]),
  slots: z.tuple([storedSlot, storedSlot, storedSlot]),
});

export type AutoStrategy = z.infer<typeof AutoStrategySchema>;
export type AutoStrategySlotIndex = z.infer<typeof AutoStrategySlotIndexSchema>;
export type AutoStrategyBook = z.infer<typeof AutoStrategyBookSchema>;

function isBook(value: unknown): value is { slots: unknown } {
  return typeof value === 'object' && value !== null && 'slots' in value;
}

function emptySlots(): AutoStrategyBook['slots'] {
  return [null, null, null];
}

function cloneSlots(book: AutoStrategyBook | null): AutoStrategyBook['slots'] {
  return book ? [book.slots[0], book.slots[1], book.slots[2]] : emptySlots();
}

export function isVacantAutoStrategyBook(book: AutoStrategyBook): boolean {
  return book.activeSlot === null && book.slots.every((slot) => slot === null);
}

/** Reads the current book. A legacy single strategy becomes 战术一 and stays active. */
export function parseStoredAutoStrategyBook(value: unknown): AutoStrategyBook {
  if (isBook(value)) {
    const book = AutoStrategyBookSchema.parse(value);
    if (book.activeSlot !== null && book.slots[book.activeSlot] === null)
      return { ...book, activeSlot: null };
    return book;
  }
  return {
    version: 1,
    activeSlot: 0,
    slots: [AutoStrategySchema.parse(value), null, null],
  };
}

export function activeStoredAutoStrategy(
  book: AutoStrategyBook | null,
): AutoStrategy | null {
  if (!book || book.activeSlot === null) return null;
  return book.slots[book.activeSlot];
}

export function saveAutoStrategySlot(
  book: AutoStrategyBook | null,
  slot: AutoStrategySlotIndex,
  strategy: AutoStrategy,
): AutoStrategyBook {
  const slots = cloneSlots(book);
  slots[slot] = strategy;
  return { version: 1, activeSlot: slot, slots };
}

export function activateStoredAutoStrategySlot(
  book: AutoStrategyBook | null,
  slot: AutoStrategySlotIndex,
): AutoStrategyBook | null {
  if (!book?.slots[slot]) return null;
  return { version: 1, activeSlot: slot, slots: book.slots };
}

export function removeAutoStrategySlot(
  book: AutoStrategyBook | null,
  slot: AutoStrategySlotIndex,
): AutoStrategyBook | null {
  if (!book) return null;
  const slots = cloneSlots(book);
  slots[slot] = null;
  let activeSlot = book.activeSlot === slot ? null : book.activeSlot;
  if (activeSlot !== null && slots[activeSlot] === null) activeSlot = null;
  const next: AutoStrategyBook = { version: 1, activeSlot, slots };
  return isVacantAutoStrategyBook(next) ? null : next;
}

export function preferDefaultAutoStrategy(
  book: AutoStrategyBook | null,
): AutoStrategyBook | null {
  if (!book || book.activeSlot === null) return book;
  const next: AutoStrategyBook = { ...book, activeSlot: null };
  return isVacantAutoStrategyBook(next) ? null : next;
}
