import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import {
  getValidatedJson,
  getValidatedQuery,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  findMembership,
  loadSectProgressionForMembership,
} from '@server/lib/repositories/sectRepository';
import {
  PlayerCommandIdempotencyError,
  type CommittedCommand,
} from '@server/lib/services/CommandExecutors';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  readResourceWithMeta,
  readResourceWithResolvedScope,
} from '@server/lib/services/ResourceReadService';
import { sectOrganizationFacade } from '@server/lib/services/sect-organization';
import {
  createPostgresSectConstructionQueryContext,
  createPostgresSectEconomyContext,
  createPostgresSectMembershipQueryContext,
  createPostgresSectQueryContext,
} from '@server/lib/services/sect-organization/PostgresSectOrganizationAdapters';
import { SectError } from '@server/lib/services/SectError';
import { SectShopError } from '@server/lib/services/SectShopService';
import {
  executeSectConstructionDonationCommand,
} from '@server/lib/services/sect-organization/SectConstructionCommand';
import {
  executeSectShopPurchaseCommand,
  executeSectStipendClaimCommand,
} from '@server/lib/services/sect-organization/SectEconomyCommand';
import {
  executeSectJoinCommand,
  executeSectPromotionCommand,
} from '@server/lib/services/sect-organization/SectMembershipCommand';
import { executeSectTaskActionCommand } from '@server/lib/services/sect-organization/SectTaskCommand';
import {
  executeSectAbilityLoadoutCommand,
  executeSectMeridianActivateCommand,
  executeSectMeridianUpdateCommand,
  executeSectMethodTrainCommand,
  executeSectPathActivateCommand,
  executeSectPathLayerUnlockCommand,
  executeSectPathTacticCommand,
} from '@server/lib/services/sect-organization/SectTraditionCommand';
import { previewSectTransfer } from '@server/lib/services/sect-organization/SectTransferApplicationService';
import { executeSectTransferCommand } from '@server/lib/services/sect-organization/SectTransferCommand';
import {
  SectAbilityLoadoutRequestSchema,
  SectDonationRequestSchema,
  SectIdempotencyKeySchema,
  SectMembersQuerySchema,
  SectMeridianLoadoutRequestSchema,
  SectMethodTrainRequestSchema,
  SectSubmissionCandidatesQuerySchema,
  SectTacticRequestSchema,
  SectTaskActionRequestSchema,
  SectTransferPreviewQuerySchema,
  SectTransferRequestSchema,
  type SectContextData,
} from '@shared/contracts/sect';
import { SectShopBuyParamsSchema } from '@shared/contracts/sectShop';
import type { SectDiscipleRank, SectRuntime } from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { createHash } from 'node:crypto';
import sectSocialRouter from './sect-social.router';

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function requireIdempotency(
  c: Context<AppEnv>,
  source: string,
  payload: unknown,
) {
  const parsed = SectIdempotencyKeySchema.safeParse(
    c.req.header('Idempotency-Key'),
  );
  if (!parsed.success)
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      '缺少有效的 Idempotency-Key 请求头',
      400,
    );
  return {
    key: parsed.data,
    fingerprint: createHash('sha256')
      .update(
        `${source}:${c.req.method}:${c.req.path}:${canonicalize(payload)}`,
      )
      .digest('hex'),
  };
}

function failure(c: Context<AppEnv>, error: unknown) {
  const lockErrorResponse = redisLockErrorResponse(error);
  if (lockErrorResponse) return lockErrorResponse;
  if (error instanceof PlayerCommandIdempotencyError)
    return c.json(
      { success: false as const, error: error.message, code: error.code },
      409,
    );
  if (error instanceof SectError)
    return c.json(
      { success: false as const, error: error.message, code: error.code },
      error.status as 400 | 403 | 409,
    );
  if (error instanceof SectShopError)
    return c.json(
      { success: false as const, error: error.message },
      error.status as 400 | 404 | 500,
    );
  console.error('[sects]', error);
  return c.json({ success: false as const, error: '宗门事务处理失败' }, 500);
}

export function createSectsRouter(
  dependencies: {
    organizationFacade?: Pick<
      typeof sectOrganizationFacade,
      'admission' | 'tradition'
    >;
    runtime?: SectRuntime;
  } = {},
) {
  const router = new Hono<AppEnv>();
  const organizationFacade =
    dependencies.organizationFacade ?? sectOrganizationFacade;
  const runtime = dependencies.runtime ?? productionSectRuntime;
  const admission = (q: Parameters<typeof organizationFacade.admission>[0]) =>
    organizationFacade.admission(q, runtime);
  const tradition = (q: Parameters<typeof organizationFacade.tradition>[0]) =>
    organizationFacade.tradition(q, runtime);

  router.get('/current/context', requireActiveCultivatorRef(), async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json(
        await readResourceWithMeta(
          { kind: 'cultivator', id: ref.cultivatorId },
          'sect.membership',
          async (q) => {
            const membership = await findMembership(ref.cultivatorId, q);
            if (!membership) {
              throw new SectError(
                'SECT_MEMBERSHIP_REQUIRED',
                '尚未拜入宗门',
                404,
              );
            }
            const organization = runtime.registry.require(
              membership.sectId,
            ).organization;
            return {
              sectId: membership.sectId,
              membershipId: membership.id,
              status: membership.status as SectContextData['status'],
              joinedAt: membership.joinedAt?.toISOString(),
              discipleRank:
                membership.discipleRank as SectContextData['discipleRank'],
              contribution: membership.contribution,
              lifetimeContribution: membership.lifetimeContribution,
              office: membership.office as SectContextData['office'],
              promotedAt: membership.promotedAt?.toISOString(),
              permissions: organization.capabilities.snapshot(
                membership.discipleRank as SectDiscipleRank,
              ),
              configVersion: membership.configVersion,
            } satisfies SectContextData;
          },
        ),
      );
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get('/current/infrastructure', requireActiveCultivatorRef(), async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json(
        await readResourceWithResolvedScope(
          'sect.infrastructure',
          async (q) => {
            const membership = await findMembership(ref.cultivatorId, q);
            if (!membership)
              throw new SectError(
                'SECT_MEMBERSHIP_REQUIRED',
                '尚未拜入宗门',
                404,
              );
            return {
              scope: { kind: 'sect', id: membership.sectId },
              data:
                await sectOrganizationFacade.membership.getInfrastructureResource(
                  ref.cultivatorId,
                  createPostgresSectMembershipQueryContext({ q, runtime }),
                ),
            };
          },
        ),
      );
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get(
    '/current/progression',
    requireActiveCultivatorRef(),
    async (c) => {
      const ref = c.get('activeCultivatorRef');
      if (!ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        return c.json(
          await readResourceWithMeta(
            { kind: 'cultivator', id: ref.cultivatorId },
            'sect.progression',
            async (q) => {
              const membership = await findMembership(ref.cultivatorId, q);
              if (!membership)
                throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门');
              return loadSectProgressionForMembership(membership, q);
            },
          ),
        );
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.get('/current/stipend', requireActiveCultivatorRef(), async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      const q = getExecutor();
      const cultivator = await q.query.cultivators.findFirst({
        columns: { id: true, realm: true },
        where: eq(cultivators.id, ref.cultivatorId),
      });
      if (!cultivator)
        throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
      const data =
        await sectOrganizationFacade.membership.getStipendResource(
          {
            id: cultivator.id,
            realm: cultivator.realm as RealmType,
          },
          createPostgresSectMembershipQueryContext({ q, runtime }),
        );
      return c.json(
        { success: true as const, data },
      );
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get(
    '/current/promotion-evaluation',
    requireActiveCultivatorRef(),
    async (c) => {
      const ref = c.get('activeCultivatorRef');
      if (!ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        const q = getExecutor();
        const cultivator = await q.query.cultivators.findFirst({
          columns: { id: true, realm: true, realm_stage: true },
          where: eq(cultivators.id, ref.cultivatorId),
        });
        if (!cultivator)
          throw new SectError(
            'SECT_MEMBERSHIP_REQUIRED',
            '角色不存在',
            404,
          );
        const data =
          await sectOrganizationFacade.membership.getPromotionEvaluationResource(
            {
              id: cultivator.id,
              realm: cultivator.realm as RealmType,
              realm_stage: cultivator.realm_stage as RealmStage,
            },
            createPostgresSectMembershipQueryContext({ q, runtime }),
          );
        return c.json({ success: true as const, data });
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.get('/current/tasks', requireActiveCultivatorRef(), async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json(
        await readResourceWithMeta({ kind: 'cultivator', id: ref.cultivatorId }, 'sect.tasks', (q) =>
          sectOrganizationFacade.tasks.queries.execute(
            { cultivatorId: ref.cultivatorId },
            createPostgresSectQueryContext({ q, runtime }),
          ),
        ),
      );
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get(
    '/current/tasks/:taskId/submission-candidates',
    requireActiveCultivatorRef(),
    validateQuery(SectSubmissionCandidatesQuerySchema),
    async (c) => {
      const ref = c.get('activeCultivatorRef');
      if (!ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      const taskId = c.req.param('taskId');
      if (!taskId || taskId.length > 64)
        return c.json({ success: false, error: '任务编号无效' }, 400);
      try {
        const query = getValidatedQuery<{
          page: number;
          pageSize: number;
          eligible: 'all' | 'yes' | 'no';
        }>(c);
        return c.json({
          success: true,
          data: await sectOrganizationFacade.tasks.submissions.execute(
            {
              cultivatorId: ref.cultivatorId,
              taskId,
              ...query,
            },
            createPostgresSectQueryContext({
              q: getExecutor(),
              runtime,
            }),
          ),
        });
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.get('/current/shop', requireActiveCultivatorRef(), async (c) => {
    const ref = c.get('activeCultivatorRef');
    if (!ref) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json(
        await readResourceWithMeta({ kind: 'cultivator', id: ref.cultivatorId }, 'sect.shop', (q) =>
          sectOrganizationFacade.economy.getShop(
            ref.cultivatorId,
            createPostgresSectEconomyContext({ q, runtime }),
          ),
        ),
      );
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get(
    '/current/construction-member',
    requireActiveCultivatorRef(),
    async (c) => {
      const ref = c.get('activeCultivatorRef');
      const user = c.get('user');
      if (!user || !ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        return c.json(
          await readResourceWithMeta(
            { kind: 'cultivator', id: ref.cultivatorId },
            'sect.construction-member',
            (q) =>
              sectOrganizationFacade.construction.getConstructionMember(
                user.id,
                ref.cultivatorId,
                createPostgresSectConstructionQueryContext({ q, runtime }),
              ),
          ),
        );
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.get(
    '/current/members',
    requireActiveCultivatorRef(),
    validateQuery(SectMembersQuerySchema),
    async (c) => {
      const ref = c.get('activeCultivatorRef');
      if (!ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        const query = getValidatedQuery<{ page: number; pageSize: number }>(c);
        return c.json(
          await readResourceWithResolvedScope(
            'sect.members',
            async (q) => {
              const membership = await findMembership(ref.cultivatorId, q);
              if (!membership)
                throw new SectError(
                  'SECT_MEMBERSHIP_REQUIRED',
                  '尚未拜入宗门',
                  404,
                );
              return {
                scope: { kind: 'sect', id: membership.sectId },
                data: await sectOrganizationFacade.membership.listMembers(
                  ref.cultivatorId,
                  query.page,
                  query.pageSize,
                  createPostgresSectMembershipQueryContext({ q, runtime }),
                ),
              };
            },
          ),
        );
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  const organizationCommandMutation = async <TResult>(
    c: Context<AppEnv>,
    source: string,
    fingerprintPayload: unknown = null,
    run: (args: {
      userId: string;
      cultivatorId: string;
      source: string;
      idempotency: { key: string; fingerprint: string };
      runtime: SectRuntime;
    }) => Promise<CommittedCommand<TResult>>,
  ) => {
    const user = c.get('user');
    const ref = c.get('activeCultivatorRef');
    if (!user || !ref)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      const committed = await run({
        userId: user.id,
        cultivatorId: ref.cultivatorId,
        source,
        idempotency: requireIdempotency(c, source, fingerprintPayload),
        runtime,
      });
      return c.json(toPlayerStateMutationResponse(committed));
    } catch (error) {
      return failure(c, error);
    }
  };

  router.post(
    '/current/tasks/:taskId/actions/:actionKey',
    requireActiveCultivatorRef(),
    validateJson(SectTaskActionRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ input: Record<string, unknown> }>(c);
      if (
        c.req.param('taskId').length > 64 ||
        c.req.param('actionKey').length > 64
      )
        return c.json({ success: false, error: '任务操作编号无效' }, 400);
      const requestId = c.req.header('Idempotency-Key') ?? '';
      const user = c.get('user');
      const ref = c.get('activeCultivatorRef');
      if (!user || !ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      return organizationCommandMutation(
        c,
        'sect_task_action',
        {
          taskId: c.req.param('taskId'),
          actionKey: c.req.param('actionKey'),
          input: body.input,
        },
        (args) =>
          executeSectTaskActionCommand({
            ...args,
            taskId: c.req.param('taskId'),
            actionKey: c.req.param('actionKey'),
            requestId,
            input: body.input,
          }),
      );
    },
  );

  router.post('/current/promotion', requireActiveCultivatorRef(), async (c) =>
    organizationCommandMutation(
      c,
      'sect_promotion',
      null,
      executeSectPromotionCommand,
    ),
  );

  router.post(
    '/current/shop/:id/buy',
    requireActiveCultivatorRef(),
    async (c) => {
      const parsed = SectShopBuyParamsSchema.safeParse({
        id: c.req.param('id'),
      });
      if (!parsed.success)
        return c.json({ success: false, error: '商品编号无效' }, 400);
      return organizationCommandMutation(
        c,
        'sect_shop_purchase',
        parsed.data,
        (args) =>
          executeSectShopPurchaseCommand({
            ...args,
            itemId: parsed.data.id,
          }),
      );
    },
  );

  router.post(
    '/current/construction/donate',
    requireActiveCultivatorRef(),
    validateJson(SectDonationRequestSchema),
    async (c) => {
      const body = getValidatedJson<{
        facilityKey: string;
        spiritStones: number;
      }>(c);
      return organizationCommandMutation(
        c,
        'sect_construction_donate',
        body,
        (args) =>
          executeSectConstructionDonationCommand({ ...args, ...body }),
      );
    },
  );

  router.post(
    '/current/stipend/claim',
    requireActiveCultivatorRef(),
    async (c) => {
      const user = c.get('user');
      const ref = c.get('activeCultivatorRef');
      if (!user || !ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      return organizationCommandMutation(
        c,
        'sect_stipend_claim',
        null,
        executeSectStipendClaimCommand,
      );
    },
  );

  router.get(
    '/current/transfer/preview',
    requireActiveCultivatorRef(),
    validateQuery(SectTransferPreviewQuerySchema),
    async (c) => {
      const ref = c.get('activeCultivatorRef');
      if (!ref)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        const query = getValidatedQuery<{
          targetSectId: string;
          reversePaths: boolean;
        }>(c);
        return c.json({
          success: true as const,
          data: await previewSectTransfer({
            cultivatorId: ref.cultivatorId,
            ...query,
            runtime,
            q: getExecutor(),
          }),
        });
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.post(
    '/current/transfer',
    requireActiveCultivatorRef(),
    validateJson(SectTransferRequestSchema),
    async (c) => {
      const body = getValidatedJson<{
        targetSectId: string;
        reversePaths: boolean;
        consumableId?: string;
      }>(c);
      return organizationCommandMutation(
        c,
        'sect_transfer',
        body,
        (args) => executeSectTransferCommand({ ...args, ...body }),
      );
    },
  );

  router.post('/:sectId/join', requireActiveCultivatorRef(), async (c) => {
    const sectId = c.req.param('sectId');
    return organizationCommandMutation(
      c,
      'sect_join',
      { sectId },
      (args) => executeSectJoinCommand({ ...args, sectId, admission }),
    );
  });

  router.post(
    '/current/methods/:methodId/train',
    requireActiveCultivatorRef(),
    validateJson(SectMethodTrainRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ targetLevel: number }>(c);
      return organizationCommandMutation(
        c,
        'sect_method_train',
        { methodId: c.req.param('methodId'), ...body },
        (args) =>
          executeSectMethodTrainCommand({
            ...args,
            tradition,
            methodId: c.req.param('methodId'),
            targetLevel: body.targetLevel,
          }),
      );
    },
  );

  router.post(
    '/current/paths/:pathId/layers/:layerId/unlock',
    requireActiveCultivatorRef(),
    async (c) => {
      return organizationCommandMutation(
        c,
        'sect_path_layer_unlock',
        {
          pathId: c.req.param('pathId'),
          layerId: c.req.param('layerId'),
        },
        (args) =>
          executeSectPathLayerUnlockCommand({
            ...args,
            tradition,
            pathId: c.req.param('pathId'),
            layerId: c.req.param('layerId'),
          }),
      );
    },
  );

  router.post(
    '/current/paths/:pathId/activate',
    requireActiveCultivatorRef(),
    async (c) =>
      organizationCommandMutation(
        c,
        'sect_path_activate',
        { pathId: c.req.param('pathId') },
        (args) =>
          executeSectPathActivateCommand({
            ...args,
            tradition,
            pathId: c.req.param('pathId'),
          }),
      ),
  );

  router.put(
    '/current/paths/:pathId/meridian-loadouts/:slot',
    requireActiveCultivatorRef(),
    validateJson(SectMeridianLoadoutRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ nodeIds: string[] }>(c);
      return organizationCommandMutation(
        c,
        'sect_meridian_update',
        { pathId: c.req.param('pathId'), slot: c.req.param('slot'), ...body },
        (args) =>
          executeSectMeridianUpdateCommand({
            ...args,
            tradition,
            pathId: c.req.param('pathId'),
            slot: Number(c.req.param('slot')),
            nodeIds: body.nodeIds,
          }),
      );
    },
  );

  router.post(
    '/current/paths/:pathId/meridian-loadouts/:slot/activate',
    requireActiveCultivatorRef(),
    async (c) =>
      organizationCommandMutation(
        c,
        'sect_meridian_activate',
        { pathId: c.req.param('pathId'), slot: c.req.param('slot') },
        (args) =>
          executeSectMeridianActivateCommand({
            ...args,
            tradition,
            pathId: c.req.param('pathId'),
            slot: Number(c.req.param('slot')),
          }),
      ),
  );

  router.put(
    '/current/ability-loadout',
    requireActiveCultivatorRef(),
    validateJson(SectAbilityLoadoutRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ abilityIds: Array<string | null> }>(c);
      return organizationCommandMutation(
        c,
        'sect_ability_loadout',
        body,
        (args) =>
          executeSectAbilityLoadoutCommand({
            ...args,
            tradition,
            abilityIds: body.abilityIds,
          }),
      );
    },
  );

  router.put(
    '/current/paths/:pathId/tactic',
    requireActiveCultivatorRef(),
    validateJson(SectTacticRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ tacticId: string }>(c);
      return organizationCommandMutation(
        c,
        'sect_tactic',
        { pathId: c.req.param('pathId'), ...body },
        (args) =>
          executeSectPathTacticCommand({
            ...args,
            tradition,
            pathId: c.req.param('pathId'),
            tacticId: body.tacticId,
          }),
      );
    },
  );

  router.route('/current', sectSocialRouter);

  return router;
}

export default createSectsRouter();
