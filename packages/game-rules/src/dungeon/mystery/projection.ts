import type {
  MysteryPlayerView,
  MysteryRecord,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  evaluateMysteryCondition,
  mysteryGuardAt,
  mysteryNeighbors,
} from './engine.js';

/** 只投影玩家已经知道的内容；真相与答案仅在结案后附带。 */
export function projectMysteryView(
  record: MysteryRecord,
  template: MysteryScenarioTemplate,
): MysteryPlayerView {
  const { caseFile, run, result } = record;
  const room =
    caseFile.rooms.find((r) => r.id === run.location) ?? caseFile.rooms[0]!;
  const npcName = (id: string) =>
    caseFile.npcs.find((n) => n.id === id)?.name ?? id;
  const knownNpcIds = new Set([
    ...caseFile.brief.relations.map((r) => r.npcId),
    ...caseFile.npcs
      .filter((n) => run.visited.includes(n.roomId))
      .map((n) => n.id),
  ]);
  const labelOf = (questionId: string, answer: string) => {
    const tq = template.questions.find((q) => q.id === questionId);
    if (tq?.answer_kind === 'npc') return npcName(answer);
    if (tq?.answer_kind === 'clue')
      return caseFile.clues.find((c) => c.id === answer)?.name ?? answer;
    return (
      caseFile.questions
        .find((q) => q.id === questionId)
        ?.options?.find((o) => o.id === answer)?.label ?? answer
    );
  };

  return {
    title: caseFile.title,
    replay: record.replay ?? false,
    confrontation: Boolean(template.finale?.points),
    ...(record.pendingGuard
      ? { pendingBattle: 'guard' as const }
      : record.verdict
        ? { pendingBattle: 'finale' as const }
        : {}),
    templateName: template.name,
    brief: {
      ...caseFile.brief,
      relations: caseFile.brief.relations.map((r) => ({
        ...r,
        name: npcName(r.npcId),
      })),
    },
    turn: run.turn,
    actionBudget: run.actionBudget,
    actionsLeft: run.actionsLeft,
    location: { id: room.id, name: room.name, description: room.description },
    exits: mysteryNeighbors(caseFile, room.id).map((r) => {
      const locked = !evaluateMysteryCondition(r.requires, run);
      const guard = locked ? undefined : mysteryGuardAt(caseFile, run, r.id);
      return {
        id: r.id,
        name: r.name,
        locked,
        ...(locked && r.lockedText ? { hint: r.lockedText } : {}),
        ...(guard
          ? {
              guard: {
                id: guard.id,
                name: guard.name,
                description: guard.description,
                canBypass: evaluateMysteryCondition(guard.bypass, run),
              },
            }
          : {}),
      };
    }),
    objects: caseFile.objects
      .filter((o) => o.roomId === room.id)
      .map((o) => ({
        id: o.id,
        name: o.name,
        searched: run.searched.includes(o.id),
      })),
    npcsHere: caseFile.npcs
      .filter((n) => n.roomId === room.id)
      .map((n) => ({ id: n.id, name: n.name, title: n.title })),
    knownNpcs: caseFile.npcs
      .filter((n) => knownNpcIds.has(n.id))
      .map((n) => ({ id: n.id, name: n.name, title: n.title })),
    clues: run.clues.flatMap((id) => {
      const c = caseFile.clues.find((x) => x.id === id);
      return c ? [{ id: c.id, name: c.name, text: c.text }] : [];
    }),
    items: run.items.flatMap((id) => {
      const i = caseFile.items.find((x) => x.id === id);
      return i ? [{ id: i.id, name: i.name, text: i.text }] : [];
    }),
    log: run.log,
    questions: template.questions.map((tq) => {
      const q = caseFile.questions.find((x) => x.id === tq.id);
      return {
        id: tq.id,
        prompt: tq.prompt,
        kind: tq.answer_kind,
        ...(tq.answer_kind === 'choice' && q?.options
          ? { options: q.options }
          : {}),
      };
    }),
    ...(result
      ? {
          result: {
            ...result,
            truth: caseFile.truth,
            explanations: caseFile.questions.map((q) => ({
              questionId: q.id,
              prompt:
                template.questions.find((tq) => tq.id === q.id)?.prompt ?? q.id,
              answerLabel: labelOf(q.id, q.answer),
              explanation: q.explanation,
            })),
          },
        }
      : {}),
  };
}
