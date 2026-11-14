import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import { MENTORSHIP_CONFIG } from '@daoyou/game-content/mentorship';
import type {
  MentorshipGraduationFacts,
  MentorshipGraduationProgress,
} from '@daoyou/game-domain/mentorship';

const realmRank = (realm: string) =>
  (REALM_VALUES as readonly string[]).indexOf(realm);

export function canMentor(realm: string): boolean {
  return realmRank(realm) >= realmRank(MENTORSHIP_CONFIG.mentorMinimumRealm);
}

export function canBecomeApprentice(
  realm: string,
  firstBoundAt: Date | string | null,
): boolean {
  const rank = realmRank(realm);
  return (
    firstBoundAt === null &&
    rank >= 0 &&
    rank < realmRank(MENTORSHIP_CONFIG.apprenticeMaximumRealmExclusive)
  );
}

/** Permanent binding survives relation dissolution and character reincarnation. */
export function apprenticeshipBlockReason(
  realm: string,
  firstBoundAt: Date | string | null,
): string | null {
  if (firstBoundAt !== null)
    return '此账号已行过拜师礼，解除、转世或师父离去后均不可再次拜师';
  if (!canBecomeApprentice(realm, firstBoundAt))
    return '仅元婴以下角色可以拜师';
  return null;
}

export function mentorshipGraduationProgress(
  facts: MentorshipGraduationFacts,
): MentorshipGraduationProgress {
  const stageIndex = (REALM_STAGE_VALUES as readonly string[]).indexOf(
    facts.realmStage,
  );
  const rank = realmRank(facts.realm);
  const targetRank = realmRank(MENTORSHIP_CONFIG.graduationRealm);
  const targetStage = (REALM_STAGE_VALUES as readonly string[]).indexOf(
    MENTORSHIP_CONFIG.graduationStage,
  );
  const realmComplete =
    rank > targetRank || (rank === targetRank && stageIndex >= targetStage);
  const manualLevel = Math.max(
    0,
    ...facts.manuals
      .filter((manual) => manual.realm === MENTORSHIP_CONFIG.manualRealm)
      .map((manual) => manual.level),
  );
  const methodCount = facts.sectMethodLevels.filter(
    (level) =>
      Number.isFinite(level) && level >= MENTORSHIP_CONFIG.sectMethodLevel,
  ).length;
  const bodyCount = facts.bodyTrackLevels.filter(
    (level) =>
      Number.isFinite(level) && level >= MENTORSHIP_CONFIG.bodyTrackLevel,
  ).length;
  const milestones: MentorshipGraduationProgress['milestones'] = [
    {
      key: 'realm',
      label: '道行有成',
      current: realmComplete ? 1 : 0,
      required: 1,
      complete: realmComplete,
      detail: '当前角色达到元婴后期或更高境界',
    },
    {
      key: 'manual',
      label: '功法精进',
      current: manualLevel,
      required: MENTORSHIP_CONFIG.manualLevel,
      complete: manualLevel >= MENTORSHIP_CONFIG.manualLevel,
      detail: '至少一门元婴期功法修至六层，无须占用功法槽',
    },
    {
      key: 'sect_methods',
      label: '宗门根基',
      current: methodCount,
      required: MENTORSHIP_CONFIG.sectMethodCount,
      complete: methodCount >= MENTORSHIP_CONFIG.sectMethodCount,
      detail: '当前宗门至少三门心法各达到60级',
    },
    {
      key: 'body',
      label: '体魄坚实',
      current: bodyCount,
      required: MENTORSHIP_CONFIG.bodyTrackCount,
      complete: bodyCount >= MENTORSHIP_CONFIG.bodyTrackCount,
      detail: '当前角色至少两条炼体轨各达到20级',
    },
  ];
  return {
    ready: milestones.every((milestone) => milestone.complete),
    milestones,
  };
}
