import type { SectV6Action, SectV6View } from '@shared/contracts/combatV6Sect';
import { sectV6Change } from '@shared/engine/combat-v6/sect-progression';
export type SectWorkspaceProps = {
  view: SectV6View;
  pending: boolean;
  act: (action: SectV6Action) => Promise<boolean>;
};
export function actionReference(view: SectV6View) {
  return {
    membershipId: view.build.membershipId!,
    expectedRevision: view.build.revision,
  };
}
export function actionProblem(view: SectV6View, action: SectV6Action) {
  if (view.blockedReason) return view.blockedReason;
  try {
    const { cost } = sectV6Change(view.progress!, view.characterLevel, action);
    if (cost.cultivationExp > view.resources.cultivationExp) return '修为不足';
    if (cost.spiritStones > view.resources.spiritStones) return '灵石不足';
    if (cost.comprehensionInsight > view.resources.comprehensionInsight)
      return '感悟不足';
  } catch (error) {
    return error instanceof Error ? error.message : '无法操作';
  }
  return null;
}
