import { REALM_VALUES } from '@daoyou/constants/realms';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { AchievementFacts } from '@daoyou/game-domain/achievements';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import { normalizeBodyCultivationState } from '@daoyou/game-rules/body-cultivation/progress';
import { apprenticeshipBlockReason } from '@daoyou/game-rules/mentorship';
import { runDbTasks, type DbExecutor } from '@server/lib/drizzle/db.js';
import {
  achievementMetrics,
  cultivatorBeastFusions,
  cultivatorBeasts,
  cultivators,
  mentorshipAccountStates,
  mentorshipRelations,
  sectMethodProgress,
  spiritFields,
} from '@server/lib/drizzle/schema.js';
import { readCharacterManuals } from '@server/lib/repositories/characterLoadoutRepository.js';
import { beastFromRow } from '@server/lib/repositories/combatV6BeastRepository.js';
import { findActiveSectMembership } from '@server/lib/repositories/sectCombatRepository.js';
import { and, asc, eq, sql } from 'drizzle-orm';

/** Only durable facts owned by this character are eligible for retrospective recognition. */
export async function readAchievementFacts(
  q: DbExecutor,
  cultivatorId: string,
  apprenticeSource?: string,
): Promise<{
  facts: AchievementFacts;
  firstRelation: { id: string; mentorName: string } | undefined;
}> {
  const [character] = await q
    .select({
      realm: cultivators.realm,
      condition: cultivators.condition,
      userId: cultivators.userId,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);
  if (!character) return { facts: { metrics: {} }, firstRelation: undefined };
  const [
    manuals,
    methodLevels,
    beasts,
    garden,
    fusions,
    relation,
    graduates,
    recorded,
    account,
  ] = await runDbTasks(q, [
    () => readCharacterManuals(cultivatorId, q),
    async () => {
      const membership = await findActiveSectMembership(cultivatorId, q);
      if (
        !membership ||
        !Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, membership.sectId)
      )
        return [];
      const definition =
        COMBAT_V6_SECT_DEFINITIONS[
          membership.sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS
        ];
      const allowed = new Set(definition.methods.map((method) => method.id));
      const rows = await q
        .select({
          methodId: sectMethodProgress.methodId,
          level: sectMethodProgress.level,
        })
        .from(sectMethodProgress)
        .where(eq(sectMethodProgress.membershipId, membership.membershipId));
      return rows
        .filter((row) => allowed.has(row.methodId))
        .map((row) => row.level);
    },
    () =>
      q
        .select()
        .from(cultivatorBeasts)
        .where(eq(cultivatorBeasts.cultivatorId, cultivatorId)),
    () =>
      q
        .select({ harvests: spiritFields.selfHarvestCount })
        .from(spiritFields)
        .where(eq(spiritFields.cultivatorId, cultivatorId))
        .limit(1),
    () =>
      q
        .select({ count: sql<number>`count(*)::int` })
        .from(cultivatorBeastFusions)
        .where(eq(cultivatorBeastFusions.cultivatorId, cultivatorId)),
    () =>
      q
        .select({
          id: mentorshipRelations.id,
          mentorName: mentorshipRelations.mentorName,
        })
        .from(mentorshipRelations)
        .where(
          and(
            eq(mentorshipRelations.discipleOriginalCultivatorId, cultivatorId),
            apprenticeSource
              ? eq(
                  sql<string>`${mentorshipRelations.id}::text`,
                  apprenticeSource,
                )
              : undefined,
          ),
        )
        .orderBy(
          asc(mentorshipRelations.startedAt),
          asc(mentorshipRelations.id),
        )
        .limit(1),
    () =>
      q
        .select({ count: sql<number>`count(*)::int` })
        .from(mentorshipRelations)
        .where(
          and(
            eq(mentorshipRelations.mentorOriginalCultivatorId, cultivatorId),
            eq(mentorshipRelations.status, 'graduated'),
          ),
        ),
    () =>
      q
        .select({
          metric: achievementMetrics.metric,
          value: achievementMetrics.value,
        })
        .from(achievementMetrics)
        .where(eq(achievementMetrics.cultivatorId, cultivatorId)),
    () =>
      q
        .select({ firstBoundAt: mentorshipAccountStates.firstBoundAt })
        .from(mentorshipAccountStates)
        .where(eq(mentorshipAccountStates.userId, character.userId))
        .limit(1),
  ] as const);
  const body = normalizeBodyCultivationState(
    character.condition as CultivatorCondition,
  );
  const snapshots: Record<string, number> = {
    'cultivation.realm_rank': Math.max(
      0,
      REALM_VALUES.indexOf(character.realm as (typeof REALM_VALUES)[number]),
    ),
    'manuals.max_level': Math.max(
      0,
      ...manuals.learned.map((manual) => manual.level),
    ),
    'sect_methods.max_level': Math.max(0, ...methodLevels),
    'body.max_track_level': Math.max(
      0,
      ...Object.values(body.tracks).map((track) => track.level),
    ),
    'beasts.max_level': Math.max(
      0,
      ...beasts.map((row) => beastFromRow(row).level),
    ),
    'beasts.fusions': fusions[0]?.count ?? 0,
    'spirit_field.harvests': garden[0]?.harvests ?? 0,
    'mentorship.bound': relation[0] ? 1 : 0,
    'mentorship.graduated_disciples': graduates[0]?.count ?? 0,
  };
  const metrics: Record<string, number> = Object.fromEntries(
    recorded.map((row) => [row.metric, row.value]),
  );
  for (const [metric, value] of Object.entries(snapshots))
    metrics[metric] = Math.max(metrics[metric] ?? 0, value);
  const blockedReason = !relation[0]
    ? apprenticeshipBlockReason(
        character.realm,
        account[0]?.firstBoundAt ?? null,
      )
    : null;
  return {
    facts: {
      metrics,
      labels: { mentorName: relation[0]?.mentorName ?? '已注销道友' },
      ...(blockedReason
        ? { blockedAchievements: { 'mentorship.apprentice': blockedReason } }
        : {}),
    },
    firstRelation: relation[0],
  };
}
