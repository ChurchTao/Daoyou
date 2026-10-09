import {
  InquiryDirectorDraftSchema,
  INQUIRY_CLUE_IDS,
  INQUIRY_TEMPLATE_ID,
  type InquiryCacheId,
  type InquiryCaseFile,
  type InquiryDirectorDraft,
  type InquiryTruthId,
} from '@daoyou/game-domain/inquiry';
import { CAVE_TRUTHS } from '@daoyou/game-content/inquiry';

export type InquiryCompileResult =
  | { ok: true; caseFile: InquiryCaseFile }
  | { ok: false; reason: string };

function cacheOf(truthId: InquiryTruthId): InquiryCacheId {
  return CAVE_TRUTHS[truthId].cache;
}

function otherCache(cache: InquiryCacheId): InquiryCacheId {
  return cache === 'mouth_jade' ? 'altar_item' : 'mouth_jade';
}

/** Bind a director draft onto the cave template. Rejects a truth the prose contradicts. */
export function compileInquiryCase(input: unknown): InquiryCompileResult {
  const parsed = InquiryDirectorDraftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: '案卷填空不完整' };
  return compileDraft(parsed.data);
}

export function compileDraft(draft: InquiryDirectorDraft): InquiryCompileResult {
  const cache = cacheOf(draft.truthId);
  const forbidden = otherCache(cache);
  const clues = INQUIRY_CLUE_IDS.map((id) => draft.clues[id]);
  if (clues.some((clue) => clue.assertsCache === forbidden)) {
    return { ok: false, reason: '线索把另一套真相说成了钥匙' };
  }
  if (!clues.some((clue) => clue.assertsCache === cache)) {
    return { ok: false, reason: '没有线索指出这套真相的正本' };
  }
  if (draft.opening.includes('正本')) {
    return { ok: false, reason: '开场白提前说出了正本' };
  }
  return {
    ok: true,
    caseFile: { ...draft, templateId: INQUIRY_TEMPLATE_ID },
  };
}
