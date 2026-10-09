import type {
  InquiryCaseFile,
  InquiryCostSpec,
  InquiryPlay,
  InquiryProgress,
  InquiryRating,
  InquiryVerdict,
} from '@daoyou/game-domain/inquiry';

export interface InquiryActionView {
  id: string;
  label: string;
  cost?: InquiryCostSpec;
  repeat: boolean;
}

export type InquiryActionEffect =
  | { kind: 'clue'; clueId: string; itemId?: string; narrationKey: string }
  | { kind: 'known'; clueId: string }
  | { kind: 'note'; narrationKey: string }
  | { kind: 'battle'; narrationKey: string }
  | { kind: 'rejected'; message: string };

export interface InquiryActionResult {
  progress: InquiryProgress;
  effect: InquiryActionEffect;
  cost?: InquiryCostSpec;
  rewardKey?: string;
}

export function createInquiryProgress(play: InquiryPlay): InquiryProgress {
  return {
    locationId: play.startLocationId,
    knownClueIds: [],
    heldItemIds: [],
    visitedLocationIds: [play.startLocationId],
    inspectedObjectIds: [],
    unlockedObjectIds: [],
    openedObjectIds: [],
    paidLifespan: false,
    foughtContainer: false,
    pendingBattle: false,
  };
}

/** Map a model tool call onto one rule action. Unknown shapes do not run. */
export function inquiryToolActionId(
  toolName: string,
  input: {
    targetId?: string;
    destinationId?: string;
    objectId?: string;
    costId?: string;
    compareId?: string;
  },
): string | null {
  if (toolName === 'inspect' && input.targetId) return `examine:${input.targetId}`;
  if (toolName === 'move' && input.destinationId) return `move:${input.destinationId}`;
  if (toolName === 'pay' && input.objectId && input.costId) {
    return `cost:${input.objectId}:${input.costId}`;
  }
  if (toolName === 'compare' && input.compareId) return `compare:${input.compareId}`;
  if (toolName === 'open' && input.targetId) return `open:${input.targetId}`;
  if (toolName === 'take' && input.targetId) return `take:${input.targetId}`;
  return null;
}

export function inquiryVisitKey(locationId: string) {
  return `inquiry:visit:${locationId}`;
}

export function inquiryBattleKey(battleId: string) {
  return `inquiry:battle:${battleId}`;
}

export const INQUIRY_COMPLETION_KEY = 'inquiry:completion';

function has(ids: string[] | undefined, id: string) {
  return (ids ?? []).includes(id);
}

function add(ids: string[], id: string) {
  return has(ids, id) ? ids : [...ids, id];
}

function objectOf(play: InquiryPlay, objectId: string) {
  return play.objects.find((object) => object.id === objectId);
}

function truthOf(play: InquiryPlay, truthId: string) {
  return play.truths.find((truth) => truth.id === truthId);
}

function locationName(play: InquiryPlay, locationId: string) {
  return play.locations.find((location) => location.id === locationId)?.name ?? locationId;
}

export function inquiryVerdictReady(play: InquiryPlay, progress: InquiryProgress) {
  return play.verdict.requiredClueIds.every((clueId) => has(progress.knownClueIds, clueId));
}

export function inquiryActions(
  progress: InquiryProgress,
  play: InquiryPlay,
  caseFile: InquiryCaseFile,
): InquiryActionView[] {
  if (progress.pendingBattle) return [];
  const name = (objectId: string) => caseFile.objects[objectId]?.name ?? objectId;
  const started = play.objects.some(
    (object) =>
      object.locationId === play.startLocationId &&
      has(progress.inspectedObjectIds, object.id),
  );
  const actions: InquiryActionView[] = [];
  if (started || progress.locationId !== play.startLocationId) {
    for (const location of play.locations) {
      if (location.id === progress.locationId) continue;
      actions.push({
        id: `move:${location.id}`,
        label: `前往${locationName(play, location.id)}`,
        repeat: true,
      });
    }
  }
  for (const object of play.objects.filter((item) => item.locationId === progress.locationId)) {
    const clueId = object.blocked?.clueId ?? object.clueId;
    const seenShut =
      Boolean(object.blocked) &&
      has(progress.inspectedObjectIds, object.id) &&
      !has(progress.unlockedObjectIds, object.id) &&
      !has(progress.knownClueIds, object.blocked?.clueId ?? '');
    actions.push({
      id: `examine:${object.id}`,
      label: object.container ? `打量${name(object.id)}` : `查看${name(object.id)}`,
      repeat: seenShut || (clueId ? has(progress.knownClueIds, clueId) : has(progress.inspectedObjectIds, object.id)),
    });
    if (
      object.blocked &&
      has(progress.inspectedObjectIds, object.id) &&
      !has(progress.unlockedObjectIds, object.id) &&
      !has(progress.knownClueIds, object.blocked.clueId)
    ) {
      for (const cost of object.blocked.costs) {
        actions.push({
          id: `cost:${object.id}:${cost.id}`,
          label: cost.label.replaceAll('{name}', name(object.id)),
          cost,
          repeat: false,
        });
      }
    }
    if (
      object.container &&
      has(progress.inspectedObjectIds, object.id) &&
      !has(progress.openedObjectIds, object.id)
    ) {
      actions.push({
        id: `open:${object.id}`,
        label: `打开${name(object.id)}`,
        repeat: false,
      });
    }
    if (
      object.takeAfterOpen &&
      play.objects.some((item) => item.container && has(progress.openedObjectIds, item.id)) &&
      object.itemId &&
      !has(progress.heldItemIds, object.itemId)
    ) {
      actions.push({
        id: `take:${object.id}`,
        label: `取下${name(object.id)}`,
        repeat: false,
      });
    }
  }
  for (const compare of play.compares) {
    if (
      compare.needs.every((clueId) => has(progress.knownClueIds, clueId)) &&
      !has(progress.knownClueIds, compare.reveals)
    ) {
      actions.push({ id: `compare:${compare.id}`, label: compare.label, repeat: false });
    }
  }
  return actions;
}

function rejected(progress: InquiryProgress, message: string): InquiryActionResult {
  return { progress, effect: { kind: 'rejected', message } };
}

function reveal(
  progress: InquiryProgress,
  clueId: string,
  narrationKey: string,
  itemId?: string,
  cost?: InquiryCostSpec,
): InquiryActionResult {
  if (has(progress.knownClueIds, clueId)) {
    return { progress, effect: { kind: 'known', clueId } };
  }
  return {
    progress: {
      ...progress,
      knownClueIds: add(progress.knownClueIds, clueId),
      heldItemIds: itemId ? add(progress.heldItemIds, itemId) : progress.heldItemIds,
      paidLifespan: progress.paidLifespan || cost?.type === 'lifespan',
    },
    effect: { kind: 'clue', clueId, itemId, narrationKey },
    cost,
  };
}

export function applyInquiryAction(
  progress: InquiryProgress,
  play: InquiryPlay,
  caseFile: InquiryCaseFile,
  actionId: string,
): InquiryActionResult {
  if (progress.pendingBattle) return rejected(progress, '先把眼前的战斗了结');
  if (!inquiryActions(progress, play, caseFile).some((action) => action.id === actionId)) {
    return rejected(progress, '这里做不到');
  }
  if (actionId.startsWith('move:')) {
    const locationId = actionId.slice('move:'.length);
    const seen = has(progress.visitedLocationIds, locationId);
    return {
      progress: {
        ...progress,
        locationId,
        visitedLocationIds: seen
          ? progress.visitedLocationIds
          : [...progress.visitedLocationIds, locationId],
      },
      effect: { kind: 'note', narrationKey: actionId },
      rewardKey: seen ? undefined : inquiryVisitKey(locationId),
    };
  }
  if (actionId.startsWith('cost:')) {
    const [, objectId, costId] = actionId.split(':');
    const object = objectOf(play, objectId ?? '');
    const cost = object?.blocked?.costs.find((item) => item.id === costId);
    if (!object?.blocked || !cost) return rejected(progress, '这里做不到');
    const unlocked = {
      ...progress,
      unlockedObjectIds: add(progress.unlockedObjectIds, object.id),
      paidLifespan: progress.paidLifespan || cost.type === 'lifespan',
    };
    if (!cost.revealsClue) {
      return {
        progress: unlocked,
        effect: { kind: 'note', narrationKey: actionId },
        cost,
      };
    }
    return reveal(unlocked, object.blocked.clueId, actionId, object.blocked.itemId, cost);
  }
  if (actionId.startsWith('examine:')) {
    const objectId = actionId.slice('examine:'.length);
    const object = objectOf(play, objectId);
    if (!object) return rejected(progress, '这里做不到');
    const seen = { ...progress, inspectedObjectIds: add(progress.inspectedObjectIds, object.id) };
    if (object.blocked && !has(progress.unlockedObjectIds, object.id)) {
      return { progress: seen, effect: { kind: 'note', narrationKey: `blocked:${object.id}` } };
    }
    const clueId = object.blocked?.clueId ?? object.clueId;
    const itemId = object.blocked?.itemId ?? object.itemId;
    if (!clueId) {
      return { progress: seen, effect: { kind: 'note', narrationKey: actionId } };
    }
    return reveal(seen, clueId, actionId, itemId);
  }
  if (actionId.startsWith('compare:')) {
    const compare = play.compares.find((item) => item.id === actionId.slice('compare:'.length));
    if (!compare) return rejected(progress, '这里做不到');
    return reveal(progress, compare.reveals, actionId);
  }
  if (actionId.startsWith('open:')) {
    const object = objectOf(play, actionId.slice('open:'.length));
    const truth = truthOf(play, caseFile.truthId);
    if (!object?.container || !truth) return rejected(progress, '这里做不到');
    if (truth.containerStartsBattle) {
      return {
        progress: { ...progress, pendingBattle: true },
        effect: { kind: 'battle', narrationKey: actionId },
      };
    }
    return {
      progress: { ...progress, openedObjectIds: add(progress.openedObjectIds, object.id) },
      effect: { kind: 'note', narrationKey: actionId },
    };
  }
  if (actionId.startsWith('take:')) {
    const object = objectOf(play, actionId.slice('take:'.length));
    if (!object?.itemId) return rejected(progress, '这里做不到');
    return {
      progress: { ...progress, heldItemIds: add(progress.heldItemIds, object.itemId) },
      effect: { kind: 'note', narrationKey: actionId },
    };
  }
  return rejected(progress, '这里做不到');
}

export function finishInquiryBattle(
  progress: InquiryProgress,
  outcome: 'victory' | 'retreat',
  objectId: string,
): InquiryProgress {
  return {
    ...progress,
    pendingBattle: false,
    openedObjectIds:
      outcome === 'victory' && objectId
        ? progress.openedObjectIds.includes(objectId)
          ? progress.openedObjectIds
          : [...progress.openedObjectIds, objectId]
        : progress.openedObjectIds,
    foughtContainer: true,
  };
}

export function judgeInquiryVerdict(
  progress: InquiryProgress,
  play: InquiryPlay,
  caseFile: InquiryCaseFile,
  verdict: InquiryVerdict,
): { correct: true; rating: InquiryRating } | { correct: false; message: string } {
  if (!inquiryVerdictReady(play, progress)) {
    return { correct: false, message: '还对不上，现场还有没看完的地方' };
  }
  const truth = truthOf(play, caseFile.truthId);
  if (!truth) return { correct: false, message: '这些证据对不上这个判断' };
  if (truth.containerJudgement === 'open' && verdict.container === 'open') {
    const opened = play.objects.some(
      (object) => object.container && has(progress.openedObjectIds, object.id),
    );
    if (!opened) return { correct: false, message: '匣子还没打开，这个判断还落不到实处' };
  }
  if (verdict.answerId !== truth.answerId || verdict.container !== truth.containerJudgement) {
    return { correct: false, message: '这些证据对不上这个判断' };
  }
  const rating: InquiryRating = progress.paidLifespan || progress.foughtContainer ? 'B' : 'A';
  return { correct: true, rating };
}

export function inquiryCanonicalProse(
  play: InquiryPlay,
  caseFile: InquiryCaseFile,
  focus: string | undefined,
) {
  if (!focus || focus.startsWith('move:')) {
    const locationId = focus?.slice('move:'.length) || play.startLocationId;
    return caseFile.locations[locationId] || caseFile.locations[play.startLocationId] || '';
  }
  if (focus.startsWith('blocked:') || focus.startsWith('examine:')) {
    const objectId = focus.slice(focus.indexOf(':') + 1);
    return caseFile.objects[objectId]?.examineText || '';
  }
  if (focus.startsWith('cost:')) {
    const [, objectId, costId] = focus.split(':');
    const object = objectOf(play, objectId ?? '');
    const cost = object?.blocked?.costs.find((item) => item.id === costId);
    if (cost?.revealsClue && object?.blocked) return caseFile.clues[object.blocked.clueId]?.body || '';
    return cost?.resultText || '';
  }
  if (focus.startsWith('compare:')) {
    const compare = play.compares.find((item) => item.id === focus.slice('compare:'.length));
    return compare ? caseFile.clues[compare.reveals]?.body || '' : '';
  }
  if (focus.startsWith('open:')) {
    return objectOf(play, focus.slice('open:'.length))?.container?.openText || '';
  }
  if (focus.startsWith('battle_won:')) {
    return objectOf(play, focus.slice('battle_won:'.length))?.container?.battleWonText || '';
  }
  if (focus.startsWith('take:')) {
    const objectId = focus.slice('take:'.length);
    return `你取下了${caseFile.objects[objectId]?.name ?? ''}。`;
  }
  return caseFile.locations[play.startLocationId] || '';
}

const NARRATION_BAN = ['并未', '没有发生', '未发生', '未涉及', '未进行', '没有出现', '并不在'];

/** Facts the narrator may retell for one committed action. Hidden truth stays out. */
export function inquiryNarrativeFacts(
  play: InquiryPlay,
  caseFile: InquiryCaseFile,
  progress: InquiryProgress,
  focus: string,
) {
  const fallback = inquiryCanonicalProse(play, caseFile, focus);
  const lines = [fallback];
  const revealed = new Set(progress.knownClueIds);
  const pushClue = (clueId: string | undefined) => {
    if (!clueId || !revealed.has(clueId)) return;
    const clue = caseFile.clues[clueId];
    if (!clue) return;
    lines.push(clue.title, clue.body);
  };
  if (focus.startsWith('examine:') || focus.startsWith('blocked:')) {
    const objectId = focus.slice(focus.indexOf(':') + 1);
    const object = play.objects.find((item) => item.id === objectId);
    pushClue(object?.blocked?.clueId ?? object?.clueId);
  }
  if (focus.startsWith('cost:')) {
    const object = play.objects.find((item) => item.id === focus.split(':')[1]);
    pushClue(object?.blocked?.clueId);
  }
  if (focus.startsWith('compare:')) {
    const compare = play.compares.find((item) => item.id === focus.slice('compare:'.length));
    pushClue(compare?.reveals);
  }
  return {
    fallback,
    lines: [...new Set(lines.filter((line) => line.length > 0))],
  };
}

export function acceptInquiryNarration(
  play: InquiryPlay,
  text: string,
  allowedLines: string[],
) {
  const prose = text.trim();
  if (prose.length < 8 || prose.length > 400) return false;
  if (NARRATION_BAN.some((phrase) => prose.includes(phrase))) return false;
  if (prose.includes(play.truths.map((truth) => truth.id).join('|'))) return false;
  for (const term of play.spoilerTerms) {
    if (!prose.includes(term)) continue;
    if (!allowedLines.some((line) => line.includes(term))) return false;
  }
  return true;
}
