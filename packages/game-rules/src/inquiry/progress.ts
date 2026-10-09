import {
  CAVE_ACTION_COSTS,
  CAVE_TRUTHS,
  INQUIRY_LOCATION_NAMES,
} from '@daoyou/game-content/inquiry';
import type {
  InquiryCaseFile,
  InquiryClueId,
  InquiryItemId,
  InquiryLocationId,
  InquiryProgress,
  InquiryRating,
  InquiryVerdict,
} from '@daoyou/game-domain/inquiry';

const CORE_CLUES: InquiryClueId[] = [
  'outward_seal',
  'altar_script',
  'wall_script',
  'handwriting_diff',
  'corpse_cache',
];

const EXAMINE_CLUE: Partial<
  Record<string, { clueId: InquiryClueId; itemId?: InquiryItemId }>
> = {
  seal_marks: { clueId: 'outward_seal' },
  corpse: { clueId: 'corpse_cache', itemId: 'mouth_jade' },
  altar_item: { clueId: 'altar_script' },
  wall_inscription: { clueId: 'wall_script' },
  stone_seam: { clueId: 'seam_note', itemId: 'seam_letter' },
};

export interface InquiryActionView {
  id: string;
  label: string;
  costActionId?: keyof typeof CAVE_ACTION_COSTS;
  repeat: boolean;
}

export type InquiryActionEffect =
  | {
      kind: 'clue';
      clueId: InquiryClueId;
      itemId?: InquiryItemId;
      narrationKey: string;
    }
  | { kind: 'known'; clueId: InquiryClueId }
  | { kind: 'note'; narrationKey: string }
  | { kind: 'battle'; narrationKey: string }
  | { kind: 'rejected'; message: string };

export interface InquiryActionResult {
  progress: InquiryProgress;
  effect: InquiryActionEffect;
  costActionId?: keyof typeof CAVE_ACTION_COSTS;
  rewardKey?: string;
}

export function createInquiryProgress(): InquiryProgress {
  return {
    locationId: 'mouth',
    knownClueIds: [],
    heldItemIds: [],
    visitedLocationIds: ['mouth'],
    arraySteadied: false,
    seamOpen: false,
    casketOpened: false,
    foughtCasket: false,
    paidLifespan: false,
    pendingBattle: false,
  };
}

export function inquiryVisitKey(locationId: InquiryLocationId) {
  return `inquiry:visit:${locationId}`;
}

export function inquiryBattleKey(battleId: string) {
  return `inquiry:battle:${battleId}`;
}

export const INQUIRY_COMPLETION_KEY = 'inquiry:completion';

function hasClue(progress: InquiryProgress, clueId: InquiryClueId) {
  return progress.knownClueIds.includes(clueId);
}

function withClue(
  progress: InquiryProgress,
  clueId: InquiryClueId,
  itemId?: InquiryItemId,
): InquiryProgress {
  return {
    ...progress,
    knownClueIds: hasClue(progress, clueId)
      ? progress.knownClueIds
      : [...progress.knownClueIds, clueId],
    heldItemIds:
      itemId && !progress.heldItemIds.includes(itemId)
        ? [...progress.heldItemIds, itemId]
        : progress.heldItemIds,
  };
}

function seamReadable(progress: InquiryProgress) {
  return progress.seamOpen || progress.arraySteadied;
}

export function inquiryActions(
  progress: InquiryProgress,
  caseFile: InquiryCaseFile,
): InquiryActionView[] {
  if (progress.pendingBattle) return [];
  const name = (objectId: keyof InquiryCaseFile['objects']) =>
    caseFile.objects[objectId].name;
  const here = progress.locationId;
  const actions: InquiryActionView[] = [];
  const other: InquiryLocationId = here === 'mouth' ? 'hall' : 'mouth';
  actions.push({
    id: `move:${other}`,
    label: `前往${INQUIRY_LOCATION_NAMES[other]}`,
    repeat: true,
  });

  if (here === 'mouth') {
    actions.push({
      id: 'examine:seal_marks',
      label: `查看${name('seal_marks')}`,
      repeat: hasClue(progress, 'outward_seal'),
    });
    if (!progress.arraySteadied) {
      actions.push({
        id: 'steady_array',
        label: '用灵石稳住残阵',
        costActionId: 'steady_array',
        repeat: false,
      });
    }
    if (!progress.seamOpen) {
      actions.push({
        id: 'force_seam',
        label: `强行拨开${name('stone_seam')}`,
        costActionId: 'force_seam',
        repeat: false,
      });
      actions.push({
        id: 'force_seam_life',
        label: `燃烧寿元震开${name('stone_seam')}`,
        costActionId: 'force_seam_life',
        repeat: false,
      });
    }
    actions.push({
      id: 'examine:stone_seam',
      label: `查看${name('stone_seam')}`,
      repeat: hasClue(progress, 'seam_note'),
    });
  } else {
    for (const objectId of [
      'corpse',
      'altar_item',
      'wall_inscription',
      'casket',
    ] as const) {
      const clueId = EXAMINE_CLUE[objectId]?.clueId;
      actions.push({
        id: `examine:${objectId}`,
        label:
          objectId === 'casket'
            ? `打量${name(objectId)}`
            : `查看${name(objectId)}`,
        repeat: clueId ? hasClue(progress, clueId) : true,
      });
    }
    if (
      hasClue(progress, 'altar_script') &&
      hasClue(progress, 'wall_script') &&
      !hasClue(progress, 'handwriting_diff')
    ) {
      actions.push({
        id: 'compare:handwriting',
        label: '对照两处笔迹',
        repeat: false,
      });
    }
    if (!progress.casketOpened) {
      actions.push({
        id: 'open:casket',
        label: `打开${name('casket')}`,
        repeat: false,
      });
    }
    if (
      caseFile.truthId === 'altar_cache' &&
      progress.casketOpened &&
      !progress.heldItemIds.includes('altar_relic')
    ) {
      actions.push({
        id: 'take:altar_item',
        label: `取下${name('altar_item')}`,
        repeat: false,
      });
    }
  }
  return actions;
}

function rejected(progress: InquiryProgress, message: string): InquiryActionResult {
  return { progress, effect: { kind: 'rejected', message } };
}

function reveal(
  progress: InquiryProgress,
  clueId: InquiryClueId,
  narrationKey: string,
  itemId?: InquiryItemId,
  costActionId?: keyof typeof CAVE_ACTION_COSTS,
): InquiryActionResult {
  if (hasClue(progress, clueId)) {
    return { progress, effect: { kind: 'known', clueId } };
  }
  return {
    progress: withClue(progress, clueId, itemId),
    effect: { kind: 'clue', clueId, itemId, narrationKey },
    costActionId,
  };
}

/** Apply one investigation action. The result progress never drops a known clue. */
export function applyInquiryAction(
  progress: InquiryProgress,
  caseFile: InquiryCaseFile,
  actionId: string,
): InquiryActionResult {
  if (progress.pendingBattle) return rejected(progress, '先把眼前的战斗了结');
  const allowed = inquiryActions(progress, caseFile).some(
    (action) => action.id === actionId,
  );
  if (!allowed) return rejected(progress, '这里做不到');

  if (actionId.startsWith('move:')) {
    const locationId = actionId.slice(5) as InquiryLocationId;
    const seen = progress.visitedLocationIds.includes(locationId);
    const next = {
      ...progress,
      locationId,
      visitedLocationIds: seen
        ? progress.visitedLocationIds
        : [...progress.visitedLocationIds, locationId],
    };
    return {
      progress: next,
      effect: { kind: 'note', narrationKey: `move:${locationId}` },
      rewardKey: seen ? undefined : inquiryVisitKey(locationId),
    };
  }

  if (actionId === 'steady_array') {
    return {
      progress: { ...progress, arraySteadied: true },
      effect: { kind: 'note', narrationKey: 'steady_array' },
      costActionId: 'steady_array',
    };
  }

  if (actionId === 'force_seam' || actionId === 'force_seam_life') {
    const opened = {
      ...progress,
      seamOpen: true,
      paidLifespan: progress.paidLifespan || actionId === 'force_seam_life',
    };
    return reveal(
      opened,
      'seam_note',
      actionId,
      'seam_letter',
      actionId,
    );
  }

  if (actionId === 'examine:stone_seam') {
    if (!seamReadable(progress)) {
      return {
        progress,
        effect: { kind: 'note', narrationKey: 'seam_shut' },
      };
    }
    return reveal(progress, 'seam_note', actionId, 'seam_letter');
  }

  if (actionId.startsWith('examine:')) {
    const objectId = actionId.slice('examine:'.length);
    const found = EXAMINE_CLUE[objectId];
    if (!found) {
      return {
        progress,
        effect: { kind: 'note', narrationKey: actionId },
      };
    }
    return reveal(progress, found.clueId, actionId, found.itemId);
  }

  if (actionId === 'compare:handwriting') {
    return reveal(progress, 'handwriting_diff', actionId);
  }

  if (actionId === 'open:casket') {
    const truth = CAVE_TRUTHS[caseFile.truthId];
    if (truth.casketStartsBattle) {
      return {
        progress: { ...progress, pendingBattle: true },
        effect: { kind: 'battle', narrationKey: 'open:casket' },
      };
    }
    return {
      progress: { ...progress, casketOpened: true },
      effect: { kind: 'note', narrationKey: 'open:casket' },
    };
  }

  if (actionId === 'take:altar_item') {
    return {
      progress: {
        ...progress,
        heldItemIds: progress.heldItemIds.includes('altar_relic')
          ? progress.heldItemIds
          : [...progress.heldItemIds, 'altar_relic'],
      },
      effect: { kind: 'note', narrationKey: actionId },
    };
  }

  return rejected(progress, '这里做不到');
}

export function finishInquiryBattle(
  progress: InquiryProgress,
  outcome: 'victory' | 'retreat',
): InquiryProgress {
  return {
    ...progress,
    pendingBattle: false,
    casketOpened: outcome === 'victory' ? true : progress.casketOpened,
    foughtCasket: true,
  };
}

export function judgeInquiryVerdict(
  progress: InquiryProgress,
  caseFile: InquiryCaseFile,
  verdict: InquiryVerdict,
):
  | { correct: true; rating: InquiryRating }
  | { correct: false; message: string } {
  const missing = CORE_CLUES.some((clueId) => !hasClue(progress, clueId));
  if (missing) return { correct: false, message: '还对不上，现场还有没看完的地方' };
  const truth = CAVE_TRUTHS[caseFile.truthId];
  if (
    truth.casket === 'open' &&
    verdict.casket === 'open' &&
    !progress.casketOpened
  ) {
    return { correct: false, message: '匣子还没打开，这个判断还落不到实处' };
  }
  if (verdict.cache !== truth.cache || verdict.casket !== truth.casket) {
    return { correct: false, message: '这些证据对不上这个判断' };
  }
  const rating: InquiryRating =
    progress.paidLifespan || progress.foughtCasket ? 'B' : 'A';
  return { correct: true, rating };
}
