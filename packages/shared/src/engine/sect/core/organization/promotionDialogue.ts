import {
  SECT_RANK_LABELS,
  type SectDiscipleRank,
} from '../domain/organization.js';

export interface SectPromotionDialogueStatus {
  nextRank: SectDiscipleRank | null;
  missingRequirements: readonly string[];
}

/**
 * Turns structured promotion state into NPC dialogue without duplicating
 * rank rules or concrete task identifiers in a scene component.
 */
export function describeSectPromotionStatus(
  status: SectPromotionDialogueStatus,
): string {
  if (!status.nextRank) return '你已列真传，眼下没有更高的弟子职阶需要考校。';

  const target = SECT_RANK_LABELS[status.nextRank];
  const missing = status.missingRequirements
    .map((requirement) => requirement.trim())
    .filter(Boolean);
  if (missing.length === 0)
    return `晋升${target}的条件已经齐备，可去宗门大殿办理晋升。`;

  return `你若想晋升${target}，尚需${missing.join('、')}。`;
}
