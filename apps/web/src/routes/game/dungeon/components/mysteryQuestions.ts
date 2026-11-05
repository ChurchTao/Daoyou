import type {
  MysteryAnswers,
  MysteryLogEntry,
  MysteryPlayerView,
} from '@daoyou/game-domain/dungeon/mystery';

export type MysteryQuestion = MysteryPlayerView['questions'][number];

/** 一道题此刻能选的答案：人物题选已知人物，线索题选已掌握的线索。 */
export function mysteryQuestionChoices(
  view: MysteryPlayerView,
  question: MysteryQuestion,
) {
  if (question.kind === 'npc')
    return view.knownNpcs.map((npc) => ({ id: npc.id, label: npc.name }));
  if (question.kind === 'clue')
    return view.clues.map((clue) => ({ id: clue.id, label: clue.name }));
  return question.options ?? [];
}

/** 草稿里这道题答案的文字；选项已不可选时视为未作答。 */
export function mysteryAnswerLabel(
  view: MysteryPlayerView,
  question: MysteryQuestion,
  answers: MysteryAnswers,
) {
  return mysteryQuestionChoices(view, question).find(
    (choice) => choice.id === answers[question.id],
  )?.label;
}

/** 与某人的对话：此人的发言，以及紧接在其回答之前的玩家提问。 */
export function mysteryDialogueWith(log: MysteryLogEntry[], npcName: string) {
  return log.filter(
    (entry, i) =>
      entry.kind === 'speech' &&
      (entry.speaker === npcName ||
        (entry.speaker === '你' && log[i + 1]?.speaker === npcName)),
  );
}
