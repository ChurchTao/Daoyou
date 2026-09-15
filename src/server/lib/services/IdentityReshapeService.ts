import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { renderPrompt } from '@server/lib/prompts';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { generateAiObject } from '@server/utils/aiClient';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload';
import {
  describeIdentityReshapeAnswers,
  getIdentityReshapeQuestions,
  IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH,
  IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH,
  IDENTITY_RESHAPE_QUESTION_COUNT,
  IDENTITY_RESHAPE_SCENARIO,
  IDENTITY_RESHAPE_SESSION_TTL_SECONDS,
  IDENTITY_RESHAPE_TALISMAN_NAME,
  selectIdentityReshapeQuestions,
  validateIdentityReshapeAnswers,
} from '@shared/config/identityReshape';
import {
  IdentityReshapeCandidateSchema,
  type IdentityReshapeAnswer,
  type IdentityReshapeNameCheck,
  type IdentityReshapeSessionDTO,
  type IdentityReshapeSessionStore,
} from '@shared/types/identityReshape';
import { and, eq, sql } from 'drizzle-orm';
import { findBagTalisman } from './BagConsumables';
import { playerCommandExecutor } from './CommandExecutors';
import { consumeConsumableById } from './cultivator/CultivatorInventoryRepository';

function sessionKey(cultivatorId: string) {
  return `identity-reshape-session:${cultivatorId}`;
}

function remainingTtl(expiresAt: number) {
  return Math.max(1, Math.ceil((expiresAt - Date.now()) / 1000));
}

function toDto(
  session: IdentityReshapeSessionStore,
): IdentityReshapeSessionDTO {
  return {
    sessionId: session.sessionId,
    questions: getIdentityReshapeQuestions(session.questionIds),
    answers: session.answers,
    description: session.description,
    candidate: session.candidate,
    nameCheck: session.nameCheck,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

async function readSession(cultivatorId: string) {
  const key = sessionKey(cultivatorId);
  const session = parseRedisJson<IdentityReshapeSessionStore>(
    await redis.get(key),
    key,
  );
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    await redis.del(key);
    return null;
  }
  return session;
}

async function requireSession(cultivatorId: string) {
  const session = await readSession(cultivatorId);
  if (!session) {
    throw new IdentityReshapeServiceError(404, '未找到进行中的改天换地会话');
  }
  return session;
}

async function writeSession(
  cultivatorId: string,
  session: IdentityReshapeSessionStore | null,
) {
  const key = sessionKey(cultivatorId);
  if (!session) {
    await redis.del(key);
    return;
  }
  await redis.set(
    key,
    JSON.stringify(session),
    'EX',
    remainingTtl(session.expiresAt),
  );
}

async function loadMatchingTalismans(
  cultivatorId: string,
  executor: DbExecutor | DbTransaction = getExecutor(),
) {
  return (
    await findBagTalisman(cultivatorId, IDENTITY_RESHAPE_SCENARIO, executor)
  ).filter(
    (item) =>
      item.spec.kind === 'talisman' &&
      item.spec.sessionMode === 'consume_on_action',
  );
}

export class IdentityReshapeServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'IdentityReshapeServiceError';
  }
}

export async function getIdentityReshapeSession(cultivatorId: string) {
  const session = await readSession(cultivatorId);
  return session ? toDto(session) : null;
}

export async function getIdentityReshapeTalismanCount(cultivatorId: string) {
  const rows = await loadMatchingTalismans(cultivatorId);
  return rows.reduce((total, row) => total + row.quantity, 0);
}

export function startIdentityReshape(args: {
  userId: string;
  cultivatorId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'identity-reshape-start',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) => {
      const existing = await readSession(args.cultivatorId);
      if (existing) {
        return {
          session: toDto(existing),
          talismanCount: await getIdentityReshapeTalismanCount(
            args.cultivatorId,
          ),
          committed: null,
        };
      }

      const talisman = (await loadMatchingTalismans(args.cultivatorId))[0];
      if (!talisman) {
        throw new IdentityReshapeServiceError(
          400,
          `缺少${IDENTITY_RESHAPE_TALISMAN_NAME}，无法开启身份重塑`,
        );
      }
      const createdAt = Date.now();
      const session: IdentityReshapeSessionStore = {
        sessionId: crypto.randomUUID(),
        cultivatorId: args.cultivatorId,
        questionIds: selectIdentityReshapeQuestions(
          IDENTITY_RESHAPE_QUESTION_COUNT,
        ).map((question) => question.id),
        answers: [],
        description: '',
        candidate: null,
        nameCheck: null,
        createdAt,
        expiresAt: createdAt + IDENTITY_RESHAPE_SESSION_TTL_SECONDS * 1000,
      };

      lease.assertHeld();
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source: 'identity_reshape_start',
        command: async (tx) => {
          await consumeConsumableById(
            args.userId,
            args.cultivatorId,
            talisman.id,
            1,
            tx,
          );
          return {
            result: { session: toDto(session) },
            resourceChanges: [
              {
                resourceTopic: 'inventory.consumables' as const,
                eventType: 'inventory.identity_reshape.consumed',
                operation: 'invalidate' as const,
              },
            ],
          };
        },
      });
      await writeSession(args.cultivatorId, session);
      return {
        session: toDto(session),
        talismanCount: await getIdentityReshapeTalismanCount(args.cultivatorId),
        committed,
      };
    },
  );
}

export async function saveIdentityReshapeDraft(args: {
  cultivatorId: string;
  answers: IdentityReshapeAnswer[];
  description: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'identity-reshape-draft',
      timeoutMs: 10_000,
      retries: 0,
    },
    async () => {
      const session = await requireSession(args.cultivatorId);
      if (session.candidate) {
        throw new IdentityReshapeServiceError(
          409,
          '新身份已经生成，无法再修改问答',
        );
      }
      if (
        !validateIdentityReshapeAnswers(
          session.questionIds,
          args.answers,
          false,
        )
      ) {
        throw new IdentityReshapeServiceError(400, '典籍问答不属于当前会话');
      }
      const next = {
        ...session,
        answers: args.answers,
        description: args.description,
      };
      await writeSession(args.cultivatorId, next);
      return toDto(next);
    },
  );
}

async function checkActiveName(
  name: string,
): Promise<IdentityReshapeNameCheck> {
  try {
    const [row] = await getExecutor()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.cultivators)
      .where(
        and(
          eq(schema.cultivators.status, 'active'),
          eq(schema.cultivators.name, name),
        ),
      );
    return Number(row?.count ?? 0) > 0 ? 'duplicate' : 'unique';
  } catch (error) {
    console.warn('[identity-reshape] name check failed', error);
    return 'unavailable';
  }
}

export function generateIdentityReshape(args: {
  cultivatorId: string;
  answers: IdentityReshapeAnswer[];
  description: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'identity-reshape-generate',
      timeoutMs: 120_000,
      retries: 0,
    },
    async () => {
      const session = await requireSession(args.cultivatorId);
      if (session.candidate) return toDto(session);
      const description = normalizeFreeformLlmInput(args.description);
      const descriptionLength = Array.from(description).length;
      if (
        descriptionLength < IDENTITY_RESHAPE_DESCRIPTION_MIN_LENGTH ||
        descriptionLength > IDENTITY_RESHAPE_DESCRIPTION_MAX_LENGTH
      ) {
        throw new IdentityReshapeServiceError(400, '身世描述需为 2-200 字');
      }
      if (
        !validateIdentityReshapeAnswers(session.questionIds, args.answers, true)
      ) {
        throw new IdentityReshapeServiceError(400, '请完成当前三道典籍问答');
      }

      const cultivator = await getExecutor().query.cultivators.findFirst({
        columns: {
          name: true,
          origin: true,
          personality: true,
          background: true,
          gender: true,
          playerRace: true,
          age: true,
          realm: true,
          realm_stage: true,
          status: true,
        },
        where: eq(schema.cultivators.id, args.cultivatorId),
      });
      if (!cultivator || cultivator.status !== 'active') {
        throw new IdentityReshapeServiceError(404, '当前没有活跃角色');
      }

      const rendered = renderPrompt('identity-reshape', {
        answerContext: describeIdentityReshapeAnswers(args.answers),
        originalCharacterContext: JSON.stringify({
          originalNarrative: {
            name: cultivator.name,
            origin: cultivator.origin,
            personality: cultivator.personality,
            background: cultivator.background,
          },
          immutableFacts: {
            gender: cultivator.gender,
            playerRace: cultivator.playerRace,
            age: cultivator.age,
            realm: cultivator.realm,
            realmStage: cultivator.realm_stage,
          },
        }),
        description,
      });
      const response = await generateAiObject({
        system: rendered.system,
        prompt: rendered.user,
        schema: IdentityReshapeCandidateSchema,
        name: '改天换地后的角色文案',
        sceneId: 'identity-reshape',
      });
      const candidate = response.output;
      const nameCheck = await checkActiveName(candidate.name);
      const next: IdentityReshapeSessionStore = {
        ...session,
        answers: args.answers,
        description,
        candidate,
        nameCheck,
      };
      await writeSession(args.cultivatorId, next);
      return toDto(next);
    },
  );
}

export function confirmIdentityReshape(args: {
  userId: string;
  cultivatorId: string;
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(args.cultivatorId),
      context: 'identity-reshape-confirm',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) => {
      const session = await requireSession(args.cultivatorId);
      if (!session.candidate) {
        throw new IdentityReshapeServiceError(400, '尚未生成可确认的新身份');
      }
      const candidate = session.candidate;
      lease.assertHeld();
      const committed = await playerCommandExecutor.execute({
        coordination: { mode: 'redis', lease },
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        source: 'identity_reshape_confirm',
        command: async (tx: DbTransaction) => {
          const [updated] = await tx
            .update(schema.cultivators)
            .set({ ...candidate, prompt: session.description })
            .where(
              and(
                eq(schema.cultivators.id, args.cultivatorId),
                eq(schema.cultivators.userId, args.userId),
                eq(schema.cultivators.status, 'active'),
              ),
            )
            .returning({ id: schema.cultivators.id });
          if (!updated) {
            throw new IdentityReshapeServiceError(404, '当前没有活跃角色');
          }
          const result = { ...candidate, prompt: session.description };
          return {
            result,
            resourceChanges: [
              {
                resourceTopic: 'player.profile' as const,
                eventType: 'profile.identity.reshaped',
                operation: 'merge' as const,
                payload: { cultivator: result },
              },
            ],
          };
        },
      });
      await writeSession(args.cultivatorId, null);
      return committed;
    },
  );
}

export function abandonIdentityReshape(cultivatorId: string) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(cultivatorId),
      context: 'identity-reshape-abandon',
      timeoutMs: 10_000,
      retries: 0,
    },
    async () => {
      await requireSession(cultivatorId);
      await writeSession(cultivatorId, null);
    },
  );
}
