import type { DbTransaction } from '@server/lib/drizzle/db';
import { createHash } from 'node:crypto';
import { getExecutor } from '@server/lib/drizzle/db';
import {
  getValidatedJson,
  getValidatedQuery,
  requireActiveCultivator,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  commitPlayerStateMutation,
  PlayerStateIdempotencyError,
  toPlayerStateMutationResponse,
} from '@server/lib/services/PlayerStateMutationService';
import { sectOrganizationFacade } from '@server/lib/services/sect-organization';
import {
  SectError,
  SectService,
  type SectServiceInstance,
} from '@server/lib/services/SectService';
import { getPlayerRuntimeCultivatorById } from '@server/lib/services/cultivatorService';
import {
  SectAbilityLoadoutRequestSchema,
  SectDailyAcceptRequestSchema,
  SectDonationRequestSchema,
  SectMembersQuerySchema,
  SectIdempotencyKeySchema,
  SectMeridianLoadoutRequestSchema,
  SectMethodTrainRequestSchema,
  SectShopPurchaseRequestSchema,
  SectSweepCompleteRequestSchema,
  SectTaskSubmitRequestSchema,
  SectTacticRequestSchema,
  type SectTaskId,
} from '@shared/contracts/sect';
import {
  listUnlockedAbilityIds,
  type CultivatorSectState,
  type SectRuntime,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { Hono, type Context } from 'hono';

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

function requireIdempotency(c: Context<AppEnv>, source: string, payload: unknown) {
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
      .update(`${source}:${c.req.method}:${c.req.path}:${canonicalize(payload)}`)
      .digest('hex'),
  };
}

function failure(c: Context<AppEnv>, error: unknown) {
  if (error instanceof PlayerStateIdempotencyError)
    return c.json(
      { success: false as const, error: error.message, code: error.code },
      409,
    );
  if (error instanceof SectError)
    return c.json(
      { success: false as const, error: error.message, code: error.code },
      error.status as 400 | 403 | 409,
    );
  console.error('[sects]', error);
  return c.json({ success: false as const, error: '宗门事务处理失败' }, 500);
}

export function createSectsRouter(
  dependencies: {
    sectService?: SectServiceInstance;
    runtime?: SectRuntime;
  } = {},
) {
  const router = new Hono<AppEnv>();
  const sectService = dependencies.sectService ?? SectService;
  const runtime =
    dependencies.runtime ?? sectService.runtime ?? productionSectRuntime;

  router.get('/catalog', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const memberships = await sectService.listMemberships(
      cultivator.id,
      getExecutor(),
    );
    const bySect = new Map(
      memberships.map((membership) => [membership.sectId, membership]),
    );
    return c.json({
      success: true,
      data: {
        playerRace: cultivator.playerRace ?? 'human',
        raceNarrative: cultivator.raceNarrative,
        sects: sectService
          .listAvailableDefinitions({
            playerRace: (cultivator.playerRace ?? 'human') as 'human',
            realm: cultivator.realm as RealmType,
            stage: cultivator.realm_stage as RealmStage,
          })
          .map((definition) => ({
            definition,
            status: bySect.get(definition.id)?.status,
            experiencedAt: bySect
              .get(definition.id)
              ?.experiencedAt?.toISOString(),
          })),
        activeSectId: memberships.find(
          (membership) => membership.status === 'active',
        )?.sectId,
      },
    });
  });

  router.get('/current', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const sect = await sectService.getState(cultivator.id, getExecutor());
    const definition = sect
      ? runtime.registry.require(sect.sectId).definition
      : null;
    const realmMethodLevelCap = sect
      ? runtime
          .progressionFor(sect.sectId)
          .methodLevelCap(
            cultivator.realm as RealmType,
            cultivator.realm_stage as RealmStage,
          )
      : 0;
    const overview = sect
      ? await sectOrganizationFacade.membership.getOverview(
          {
            id: cultivator.id,
            realm: cultivator.realm as RealmType,
            realm_stage: cultivator.realm_stage as RealmStage,
          },
          realmMethodLevelCap,
          getExecutor(),
        )
      : null;
    return c.json({
      success: true,
      data: {
        playerRace: cultivator.playerRace ?? 'human',
        raceNarrative: cultivator.raceNarrative,
        definition,
        sect: sect ?? null,
        methodLevelCap: overview?.methodLevelCap ?? 0,
        knownAbilityIds:
          sect && definition ? listUnlockedAbilityIds(definition, sect) : [],
        overview,
      },
    });
  });

  router.get('/current/overview', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      const sect = await sectService.getState(cultivator.id, getExecutor());
      if (!sect) throw new SectError('SECT_TRIAL_REQUIRED', '尚未拜入宗门');
      const realmCap = runtime
        .progressionFor(sect.sectId)
        .methodLevelCap(
          cultivator.realm as RealmType,
          cultivator.realm_stage as RealmStage,
        );
      return c.json({
        success: true,
        data: await sectOrganizationFacade.membership.getOverview(
          {
            id: cultivator.id,
            realm: cultivator.realm as RealmType,
            realm_stage: cultivator.realm_stage as RealmStage,
          },
          realmCap,
          getExecutor(),
        ),
      });
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get('/current/tasks', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json({
        success: true,
        data: await sectOrganizationFacade.tasks.getTasks(cultivator.id),
      });
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get('/current/shop', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json({
        success: true,
        data: await sectOrganizationFacade.economy.getShop(cultivator.id),
      });
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get('/current/construction', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      return c.json({
        success: true,
        data: await sectOrganizationFacade.construction.getConstruction(cultivator.id),
      });
    } catch (error) {
      return failure(c, error);
    }
  });

  router.get(
    '/current/members',
    requireActiveCultivator(),
    validateQuery(SectMembersQuerySchema),
    async (c) => {
      const cultivator = c.get('cultivator');
      if (!cultivator?.id)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        const query = getValidatedQuery<{ page: number; pageSize: number }>(c);
        return c.json({
          success: true,
          data: await sectOrganizationFacade.membership.listMembers(
            cultivator.id,
            query.page,
            query.pageSize,
          ),
        });
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  const organizationMutation = async <T>(
    c: Context<AppEnv>,
    source: string,
    run: (args: {
      userId: string;
      cultivatorId: string;
      tx: DbTransaction;
    }) => Promise<T>,
    changes: Array<{
      domain: 'sect' | 'tasks' | 'loadout' | 'currency' | 'progress';
      eventType: string;
      invalidates?: Array<'sect' | 'tasks' | 'loadout' | 'currency' | 'progress'>;
    }>,
    fingerprintPayload: unknown = null,
  ) => {
    const user = c.get('user');
    const cultivator = c.get('cultivator');
    if (!user || !cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      const committed = await commitPlayerStateMutation({
        userId: user.id,
        cultivatorId: cultivator.id,
        source,
        idempotency: requireIdempotency(c, source, fingerprintPayload),
        allowEmpty: changes.length === 0,
        run: async (tx) => ({
          result: await run({
            userId: user.id,
            cultivatorId: cultivator.id!,
            tx,
          }),
          changes,
        }),
      });
      return c.json(toPlayerStateMutationResponse(committed));
    } catch (error) {
      return failure(c, error);
    }
  };

  router.post(
    '/current/tasks/daily/accept',
    requireActiveCultivator(),
    validateJson(SectDailyAcceptRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ taskId: SectTaskId }>(c);
      return organizationMutation(
        c,
        'sect_daily_accept',
        ({ cultivatorId, tx }) =>
          sectOrganizationFacade.tasks.acceptDaily(cultivatorId, body.taskId, tx),
        [{ domain: 'tasks', eventType: 'sect.task_accepted' }],
        body,
      );
    },
  );

  router.post(
    '/current/tasks/gate_sweep/start',
    requireActiveCultivator(),
    async (c) =>
      organizationMutation(
        c,
        'sect_gate_sweep_start',
        ({ cultivatorId, tx }) =>
          sectOrganizationFacade.tasks.startSweep(cultivatorId, tx),
        [],
        {},
      ),
  );

  router.post(
    '/current/tasks/gate_sweep/complete',
    requireActiveCultivator(),
    validateJson(SectSweepCompleteRequestSchema),
    async (c) => {
      const body = getValidatedJson<{
        sessionId: string;
        rulesVersion: number;
        segments: Array<{
          ticks: number;
          direction: number | null;
          sweeping: boolean;
        }>;
      }>(c);
      return organizationMutation(
        c,
        'sect_gate_sweep',
        ({ userId, cultivatorId, tx }) =>
          sectOrganizationFacade.tasks.completeSweep(
            userId,
            cultivatorId,
            body,
            tx,
          ),
        [
          {
            domain: 'tasks',
            eventType: 'sect.daily_completed',
            invalidates: ['sect', 'currency', 'progress'],
          },
          { domain: 'sect', eventType: 'sect.contribution_earned' },
          { domain: 'currency', eventType: 'sect.daily_stones_earned' },
          { domain: 'progress', eventType: 'sect.daily_cultivation_earned' },
        ],
        body,
      );
    },
  );

  router.post(
    '/current/tasks/:taskId/submit',
    requireActiveCultivator(),
    validateJson(SectTaskSubmitRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ itemId: string; quantity: number }>(c);
      return organizationMutation(
        c,
        'sect_task_submit',
        ({ userId, cultivatorId, tx }) =>
          sectOrganizationFacade.tasks.submitTaskItem(
            userId,
            cultivatorId,
            c.req.param('taskId') as SectTaskId,
            body.itemId,
            body.quantity,
            tx,
          ),
        [
          {
            domain: 'tasks',
            eventType: 'sect.task_submitted',
            invalidates: ['sect', 'loadout', 'currency', 'progress'],
          },
          { domain: 'sect', eventType: 'sect.contribution_earned' },
          { domain: 'loadout', eventType: 'sect.task_item_consumed' },
        ],
        { taskId: c.req.param('taskId'), ...body },
      );
    },
  );

  router.post(
    '/current/tasks/:taskId/challenge',
    requireActiveCultivator(),
    async (c) =>
      organizationMutation(
        c,
        'sect_task_challenge',
        ({ userId, cultivatorId, tx }) =>
          sectOrganizationFacade.tasks.challengeTask(
            userId,
            cultivatorId,
            c.req.param('taskId') as SectTaskId,
            tx,
            c.req.header('Idempotency-Key'),
          ),
        [
          {
            domain: 'tasks',
            eventType: 'sect.task_challenged',
            invalidates: ['sect', 'currency', 'progress'],
          },
          { domain: 'sect', eventType: 'sect.contribution_maybe_earned' },
        ],
        { taskId: c.req.param('taskId') },
      ),
  );

  router.post('/current/promotion', requireActiveCultivator(), async (c) =>
    organizationMutation(
      c,
      'sect_promotion',
      ({ cultivatorId, tx }) => {
        const cultivator = c.get('cultivator')!;
        return sectOrganizationFacade.membership.promote(
          {
            id: cultivatorId,
            realm: cultivator.realm as RealmType,
            realm_stage: cultivator.realm_stage as RealmStage,
          },
          tx,
        );
      },
      [{ domain: 'sect', eventType: 'sect.promoted' }],
      null,
    ),
  );

  router.post(
    '/current/shop/purchase',
    requireActiveCultivator(),
    validateJson(SectShopPurchaseRequestSchema),
    async (c) => {
      const body = getValidatedJson<{
        itemId: string;
        quantity: number;
      }>(c);
      return organizationMutation(
        c,
        'sect_shop_purchase',
        ({ userId, cultivatorId, tx }) =>
          sectOrganizationFacade.economy.purchaseShopItem(
            userId,
            cultivatorId,
            body.itemId,
            body.quantity,
            tx,
          ),
        [
          {
            domain: 'sect',
            eventType: 'sect.shop_purchased',
            invalidates: ['loadout'],
          },
          { domain: 'loadout', eventType: 'sect.shop_item_granted' },
        ],
        body,
      );
    },
  );

  router.post(
    '/current/construction/donate',
    requireActiveCultivator(),
    validateJson(SectDonationRequestSchema),
    async (c) => {
      const body = getValidatedJson<{
        demandId: string;
        itemId?: string;
        quantity: number;
      }>(c);
      return organizationMutation(
        c,
        'sect_construction_donate',
        ({ cultivatorId, tx }) =>
          sectOrganizationFacade.construction.donate(
            cultivatorId,
            body,
            tx,
          ),
        [
          {
            domain: 'sect',
            eventType: 'sect.construction_donated',
            invalidates: ['loadout', 'currency'],
          },
          { domain: 'loadout', eventType: 'sect.donation_item_consumed' },
          { domain: 'currency', eventType: 'sect.donation_currency_changed' },
        ],
        body,
      );
    },
  );

  router.post('/current/stipend/claim', requireActiveCultivator(), async (c) =>
    organizationMutation(
      c,
      'sect_stipend_claim',
      ({ userId, cultivatorId, tx }) =>
        sectOrganizationFacade.economy.claimStipend(userId, cultivatorId, tx),
      [
        {
          domain: 'sect',
          eventType: 'sect.stipend_claimed',
          invalidates: ['loadout', 'currency'],
        },
        { domain: 'loadout', eventType: 'sect.stipend_items_granted' },
        { domain: 'currency', eventType: 'sect.stipend_stones_granted' },
      ],
      null,
    ),
  );

  router.get('/:sectId', requireActiveCultivator(), async (c) => {
    const cultivator = c.get('cultivator');
    if (!cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      const definition = runtime.registry.get(
        c.req.param('sectId'),
      )?.definition;
      if (!definition) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
      const sect = await sectService.getStateForSect(
        cultivator.id,
        definition.id,
        getExecutor(),
      );
      return c.json({
        success: true,
        data: {
          definition,
          sect: sect ?? null,
          methodLevelCap: runtime
            .progressionFor(definition.id)
            .methodLevelCap(
              cultivator.realm as RealmType,
              cultivator.realm_stage as RealmStage,
            ),
          knownAbilityIds: sect ? listUnlockedAbilityIds(definition, sect) : [],
        },
      });
    } catch (error) {
      return failure(c, error);
    }
  });

  router.post('/:sectId/trial', requireActiveCultivator(), async (c) => {
    const user = c.get('user');
    const cultivator = c.get('cultivator');
    if (!user || !cultivator?.id)
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    try {
      const module = runtime.registry.get(c.req.param('sectId'));
      if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
      const runtimeCultivator = await getPlayerRuntimeCultivatorById(
        user.id,
        cultivator.id,
        getExecutor(),
      );
      if (!runtimeCultivator)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      const { trainee, opponent } = sectService.createTrialScenario(
        module.definition.id,
        runtimeCultivator,
      );
      const battle = simulateBattleV5(trainee, opponent);
      const committed = await commitPlayerStateMutation({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'sect_trial',
        idempotency: requireIdempotency(c, 'sect_trial', {
          sectId: module.definition.id,
        }),
        run: async (tx) => {
          const sect = await sectService.recordExperience(
            cultivator.id!,
            module.definition.id,
            tx,
          );
          return {
            result: { sect, battle },
            changes: [
              {
                domain: 'sect' as const,
                eventType: 'sect.experienced',
                patch: { sect },
              },
            ],
          };
        },
      });
      return c.json(toPlayerStateMutationResponse(committed));
    } catch (error) {
      return failure(c, error);
    }
  });

  router.post('/:sectId/join', requireActiveCultivator(), async (c) => {
    const sectId = c.req.param('sectId');
    return mutateSect(
      c,
      'sect_join',
      (id, tx) => sectService.join(id, sectId, tx),
      'sect.joined',
      true,
    );
  });

  router.post(
    '/current/methods/:methodId/train',
    requireActiveCultivator(),
    validateJson(SectMethodTrainRequestSchema),
    async (c) => {
      const user = c.get('user');
      const cultivator = c.get('cultivator');
      if (!user || !cultivator?.id)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        const body = getValidatedJson<{ targetLevel: number }>(c);
        const committed = await commitPlayerStateMutation({
          userId: user.id,
          cultivatorId: cultivator.id,
          source: 'sect_method_train',
          idempotency: requireIdempotency(c, 'sect_method_train', {
            methodId: c.req.param('methodId'),
            ...body,
          }),
          run: async (tx) => {
            const result = await sectService.trainMethod(
              {
                cultivatorId: cultivator.id!,
                methodId: c.req.param('methodId'),
                targetLevel: body.targetLevel,
              },
              tx,
            );
            return {
              result,
              changes: [
                {
                  domain: 'sect' as const,
                  eventType: 'sect.method_trained',
                  patch: { sect: result.sect },
                  invalidates: ['progress' as const, 'currency' as const],
                },
                {
                  domain: 'currency' as const,
                  eventType: 'sect.method_cost_paid',
                },
                {
                  domain: 'progress' as const,
                  eventType: 'sect.method_cultivation_paid',
                },
              ],
            };
          },
        });
        return c.json(toPlayerStateMutationResponse(committed));
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.post(
    '/current/paths/:pathId/layers/:layerId/unlock',
    requireActiveCultivator(),
    async (c) => {
      const user = c.get('user');
      const cultivator = c.get('cultivator');
      if (!user || !cultivator?.id)
        return c.json({ success: false, error: '当前没有活跃角色' }, 404);
      try {
        const committed = await commitPlayerStateMutation({
          userId: user.id,
          cultivatorId: cultivator.id,
          source: 'sect_path_layer_unlock',
          idempotency: requireIdempotency(c, 'sect_path_layer_unlock', {
            pathId: c.req.param('pathId'),
            layerId: c.req.param('layerId'),
          }),
          run: async (tx) => {
            const result = await sectService.unlockPathLayer(
              {
                cultivatorId: cultivator.id!,
                pathId: c.req.param('pathId'),
                layerId: c.req.param('layerId'),
              },
              tx,
            );
            return {
              result,
              changes: [
                {
                  domain: 'sect' as const,
                  eventType: 'sect.path_layer_unlocked',
                  patch: { sect: result.sect },
                  invalidates: ['progress' as const, 'currency' as const],
                },
                {
                  domain: 'currency' as const,
                  eventType: 'sect.path_cost_paid',
                },
                {
                  domain: 'progress' as const,
                  eventType: 'sect.path_cultivation_paid',
                },
              ],
            };
          },
        });
        return c.json(toPlayerStateMutationResponse(committed));
      } catch (error) {
        return failure(c, error);
      }
    },
  );

  router.post(
    '/current/paths/:pathId/activate',
    requireActiveCultivator(),
    async (c) =>
      mutateSect(
        c,
        'sect_path_activate',
        (id, tx) => sectService.activatePath(id, c.req.param('pathId'), tx),
        'sect.path_activated',
      ),
  );

  router.put(
    '/current/paths/:pathId/meridian-loadouts/:slot',
    requireActiveCultivator(),
    validateJson(SectMeridianLoadoutRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ nodeIds: string[] }>(c);
      return mutateSect(
        c,
        'sect_meridian_update',
        (id, tx) =>
          sectService.setMeridianLoadout(
            id,
            c.req.param('pathId'),
            Number(c.req.param('slot')),
            body.nodeIds,
            tx,
          ),
        'sect.meridian_updated',
        false,
        body,
      );
    },
  );

  router.post(
    '/current/paths/:pathId/meridian-loadouts/:slot/activate',
    requireActiveCultivator(),
    async (c) =>
      mutateSect(
        c,
        'sect_meridian_activate',
        (id, tx) =>
          sectService.activateMeridianLoadout(
            id,
            c.req.param('pathId'),
            Number(c.req.param('slot')),
            tx,
          ),
        'sect.meridian_activated',
      ),
  );

  router.put(
    '/current/ability-loadout',
    requireActiveCultivator(),
    validateJson(SectAbilityLoadoutRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ abilityIds: Array<string | null> }>(c);
      return mutateSect(
        c,
        'sect_ability_loadout',
        (id, tx) => sectService.setAbilityLoadout(id, body.abilityIds, tx),
        'sect.ability_loadout_updated',
        true,
        body,
      );
    },
  );

  router.put(
    '/current/paths/:pathId/tactic',
    requireActiveCultivator(),
    validateJson(SectTacticRequestSchema),
    async (c) => {
      const body = getValidatedJson<{ tacticId: string }>(c);
      return mutateSect(
        c,
        'sect_tactic',
        (id, tx) =>
          sectService.setPathTactic(
            id,
            c.req.param('pathId'),
            body.tacticId,
            tx,
          ),
        'sect.tactic_updated',
        false,
        body,
      );
    },
  );

  return router;
}

async function mutateSect(
  c: Context<AppEnv>,
  source: string,
  run: (
    cultivatorId: string,
    tx: DbTransaction,
  ) => Promise<CultivatorSectState>,
  eventType: string,
  loadout = false,
  fingerprintPayload: unknown = null,
) {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id)
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source,
      idempotency: requireIdempotency(c, source, fingerprintPayload),
      run: async (tx) => {
        const sect = await run(cultivator.id!, tx);
        return {
          result: { sect },
          changes: [
            { domain: 'sect' as const, eventType, patch: { sect } },
            ...(loadout
              ? [
                  {
                    domain: 'loadout' as const,
                    eventType: 'sect.ability_loadout_changed',
                  },
                ]
              : []),
          ],
        };
      },
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return failure(c, error);
  }
}

export default createSectsRouter();
