import { CHARACTER_MANUALS_V1 } from '@daoyou/game-content/manuals';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { MentorshipGraduationProgress } from '@daoyou/game-domain/mentorship';
import { normalizeBodyCultivationState } from '@daoyou/game-rules/body-cultivation/progress';
import { mentorshipGraduationProgress } from '@daoyou/game-rules/mentorship';
import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  mentorshipRelations,
  mentorshipRequests,
  sectMethodProgress,
} from '@server/lib/drizzle/schema.js';
import { readCharacterManuals } from '@server/lib/repositories/characterLoadoutRepository.js';
import { findActiveSectMembership } from '@server/lib/repositories/sectCombatRepository.js';
import { and, eq, gt, ne, sql } from 'drizzle-orm';

export async function readMentorshipGraduation(
  cultivatorId: string | null,
  q: DbExecutor = db,
): Promise<MentorshipGraduationProgress> {
  const row = cultivatorId
    ? await q.query.cultivators.findFirst({
        where: eq(cultivators.id, cultivatorId),
      })
    : undefined;
  if (!row)
    return mentorshipGraduationProgress({
      realm: '',
      realmStage: '',
      manuals: [],
      sectMethodLevels: [],
      bodyTrackLevels: [],
    });
  const manuals = await readCharacterManuals(row.id, q);
  const membership = await findActiveSectMembership(row.id, q);
  const methodLevels = membership
    ? await q
        .select({
          methodId: sectMethodProgress.methodId,
          level: sectMethodProgress.level,
        })
        .from(sectMethodProgress)
        .where(eq(sectMethodProgress.membershipId, membership.membershipId))
    : [];
  const definition =
    membership && Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, membership.sectId)
      ? COMBAT_V6_SECT_DEFINITIONS[
          membership.sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS
        ]
      : null;
  const allowedMethods = new Set(
    definition?.methods.map((method) => method.id) ?? [],
  );
  const body = normalizeBodyCultivationState(
    row.condition as CultivatorCondition,
  );
  return mentorshipGraduationProgress({
    realm: row.realm,
    realmStage: row.realm_stage,
    manuals: manuals.learned.flatMap((learned) => {
      const definition = CHARACTER_MANUALS_V1.find(
        (manual) => manual.id === learned.manualId,
      );
      return definition
        ? [{ realm: definition.realm, level: learned.level }]
        : [];
    }),
    sectMethodLevels: methodLevels
      .filter((method) => allowedMethods.has(method.methodId))
      .map((method) => method.level),
    bodyTrackLevels: Object.values(body.tracks).map((track) => track.level),
  });
}

export async function getMentorshipSummary(
  userId: string,
  cultivatorId?: string | null,
) {
  const [requests] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mentorshipRequests)
    .where(
      and(
        sql`(${mentorshipRequests.mentorUserId} = ${userId} OR ${mentorshipRequests.discipleUserId} = ${userId})`,
        ne(mentorshipRequests.initiatorUserId, userId),
        eq(mentorshipRequests.status, 'pending'),
        gt(mentorshipRequests.expiresAt, new Date()),
      ),
    );
  const relations = await db
    .select()
    .from(mentorshipRelations)
    .where(
      and(
        eq(mentorshipRelations.discipleUserId, userId),
        eq(mentorshipRelations.status, 'active'),
      ),
    );
  const current = relations.find(
    (relation) => relation.discipleCultivatorId === cultivatorId,
  );
  const progress = current
    ? await readMentorshipGraduation(current.discipleCultivatorId)
    : null;
  return {
    mentorshipRequests: requests?.count ?? 0,
    mentorshipReadyToGraduate: progress?.ready ? 1 : 0,
  };
}
