import {
  inquiryDirectorSchema,
  type InquiryCaseFile,
  type InquiryDirectorDraft,
  type InquiryPlay,
} from '@daoyou/game-domain/inquiry';

export type InquiryCompileResult =
  | { ok: true; caseFile: InquiryCaseFile }
  | { ok: false; reason: string };

function spoils(play: InquiryPlay, text: string) {
  return play.spoilerTerms.some((term) => text.includes(term));
}

/** Bind a director draft onto a play. The play, not the prose, decides what can be done. */
export function compileInquiryCase(play: InquiryPlay, input: unknown): InquiryCompileResult {
  const parsed = inquiryDirectorSchema(play).safeParse(input);
  if (!parsed.success) return { ok: false, reason: '案卷填空不完整' };
  const draft = parsed.data as InquiryDirectorDraft;
  const truth = play.truths.find((item) => item.id === draft.truthId);
  if (!truth) return { ok: false, reason: '案卷选了玩法里没有的真相' };
  const clues = play.clueIds.map((id) => draft.clues[id]!);
  if (clues.some((clue) => clue.assertsAnswer && clue.assertsAnswer !== truth.answerId)) {
    return { ok: false, reason: '线索把另一套真相说成了钥匙' };
  }
  if (!clues.some((clue) => clue.assertsAnswer === truth.answerId)) {
    return { ok: false, reason: '没有线索指出这套真相的答案' };
  }
  const visible = [
    ...Object.values(draft.locations),
    ...Object.values(draft.objects).map((object) => object.examineText),
  ];
  if (visible.some((text) => spoils(play, text))) {
    return { ok: false, reason: '第一眼正文提前说出了答案' };
  }
  for (const object of play.objects) {
    const text = draft.objects[object.id]?.examineText ?? '';
    if (object.blocked && !new RegExp(object.blocked.pattern).test(text)) {
      return { ok: false, reason: '障碍物的第一眼没有写明它打不开' };
    }
    if (object.container && !new RegExp(object.container.pattern).test(text)) {
      return { ok: false, reason: '容器的第一眼没有写出打开它的原因' };
    }
  }
  return { ok: true, caseFile: { ...draft, playId: play.id } };
}

export function assertInquiryPlay(play: InquiryPlay) {
  const locationIds = new Set(play.locations.map((location) => location.id));
  const clueIds = new Set(play.clueIds);
  const answerIds = new Set(play.verdict.answers.map((answer) => answer.id));
  if (!locationIds.has(play.startLocationId)) throw new Error(`${play.id} 缺少起点`);
  for (const object of play.objects) {
    if (!locationIds.has(object.locationId)) throw new Error(`${play.id} 物件地点不存在`);
    for (const clueId of [object.clueId, object.blocked?.clueId]) {
      if (clueId && !clueIds.has(clueId)) throw new Error(`${play.id} 线索 ${clueId} 未登记`);
    }
  }
  for (const compare of play.compares) {
    for (const clueId of [...compare.needs, compare.reveals]) {
      if (!clueIds.has(clueId)) throw new Error(`${play.id} 对照线索 ${clueId} 未登记`);
    }
  }
  for (const clueId of play.verdict.requiredClueIds) {
    if (!clueIds.has(clueId)) throw new Error(`${play.id} 定论线索 ${clueId} 未登记`);
  }
  for (const truth of play.truths) {
    if (!answerIds.has(truth.answerId)) throw new Error(`${play.id} 真相选项不存在`);
  }
  if (!play.objects.some((object) => object.container)) {
    throw new Error(`${play.id} 缺少容器`);
  }
}
