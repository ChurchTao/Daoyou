import type { DbTransaction } from '@server/lib/drizzle/db';
import { getExecutor } from '@server/lib/drizzle/db';
import { getValidatedJson, requireActiveCultivator, validateJson } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { commitPlayerStateMutation, toPlayerStateMutationResponse } from '@server/lib/services/PlayerStateMutationService';
import { SectCommissionService } from '@server/lib/services/SectCommissionService';
import { SectError, SectService } from '@server/lib/services/SectService';
import { getPlayerRuntimeCultivatorById } from '@server/lib/services/cultivatorService';
import {
  SectAbilityLoadoutRequestSchema,
  SectMeridianLoadoutRequestSchema,
  SectMethodTrainRequestSchema,
  SectPathTrainRequestSchema,
  SectTacticRequestSchema,
} from '@shared/contracts/sect';
import {
  getSectMethodLevelCap,
  listUnlockedAbilityIds,
  sectRegistry,
  type CultivatorSectState,
} from '@shared/engine/sect';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import type { Cultivator } from '@shared/types/cultivator';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { Hono, type Context } from 'hono';

const router = new Hono<AppEnv>();

function failure(c: Parameters<Parameters<typeof router.onError>[0]>[1], error: unknown) {
  if (error instanceof SectError) return c.json({ success: false as const, error: error.message, code: error.code }, error.status as 400 | 409);
  console.error('[sects]', error);
  return c.json({ success: false as const, error: '宗门事务处理失败' }, 500);
}

router.get('/catalog', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  const memberships = await SectService.listMemberships(cultivator.id, getExecutor());
  const bySect = new Map(memberships.map((membership) => [membership.sectId, membership]));
  return c.json({ success: true, data: {
    playerRace: cultivator.playerRace ?? 'human',
    raceNarrative: cultivator.raceNarrative,
    sects: SectService.listDefinitions()
      .filter((definition) => definition.raceIds.includes((cultivator.playerRace ?? 'human') as 'human'))
      .map((definition) => ({
        definition,
        status: bySect.get(definition.id)?.status,
        experiencedAt: bySect.get(definition.id)?.experiencedAt?.toISOString(),
      })),
    activeSectId: memberships.find((membership) => membership.status === 'active')?.sectId,
  } });
});

router.get('/current', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  const sect = await SectService.getState(cultivator.id, getExecutor());
  const definition = sect ? sectRegistry.require(sect.sectId).definition : null;
  const commission = await SectCommissionService.getToday(cultivator.id, getExecutor());
  return c.json({ success: true, data: {
    playerRace: cultivator.playerRace ?? 'human', raceNarrative: cultivator.raceNarrative,
    definition, sect: sect ?? null,
    methodLevelCap: getSectMethodLevelCap(cultivator.realm as RealmType, cultivator.realm_stage as RealmStage),
    knownAbilityIds: sect && definition ? listUnlockedAbilityIds(definition, sect) : [], commission,
  } });
});

router.get('/:sectId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const definition = sectRegistry.get(c.req.param('sectId'))?.definition;
    if (!definition) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const sect = await SectService.getStateForSect(cultivator.id, definition.id, getExecutor());
    return c.json({ success: true, data: {
      definition, sect: sect ?? null,
      methodLevelCap: getSectMethodLevelCap(cultivator.realm as RealmType, cultivator.realm_stage as RealmStage),
      knownAbilityIds: sect ? listUnlockedAbilityIds(definition, sect) : [],
    } });
  } catch (error) { return failure(c, error); }
});

router.post('/:sectId/trial', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const module = sectRegistry.get(c.req.param('sectId'));
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    const runtimeCultivator = await getPlayerRuntimeCultivatorById(user.id, cultivator.id, getExecutor());
    if (!runtimeCultivator) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const borrowedSect: CultivatorSectState = {
      membershipId: 'trial', sectId: module.definition.id, status: 'active', contribution: 0,
      configVersion: module.definition.configVersion, methods: module.trial.methods, paths: [],
      abilityLoadout: module.trial.abilityLoadout,
    };
    const trainee: Cultivator = { ...runtimeCultivator, sect: borrowedSect, skills: [] };
    const opponent: Cultivator = { ...trainee, id: `${cultivator.id}-${module.definition.id}-trial`, name: module.trial.opponentName, sect: undefined, skills: [] };
    const battle = simulateBattleV5(trainee, opponent);
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_trial', run: async (tx) => {
      const sect = await SectService.recordExperience(cultivator.id!, module.definition.id, tx);
      return { result: { sect, battle }, changes: [{ domain: 'sect' as const, eventType: 'sect.experienced', patch: { sect } }] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/:sectId/join', requireActiveCultivator(), async (c) => {
  const sectId = c.req.param('sectId');
  return mutateSect(c, 'sect_join', (id, tx) => SectService.join(id, sectId, tx), 'sect.joined', true);
});

router.post('/current/methods/:methodId/train', requireActiveCultivator(), validateJson(SectMethodTrainRequestSchema), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const body = getValidatedJson<{ targetLevel: number }>(c);
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_method_train', run: async (tx) => {
      const result = await SectService.trainMethod({ cultivatorId: cultivator.id!, methodId: c.req.param('methodId'), targetLevel: body.targetLevel }, tx);
      return { result, changes: [
        { domain: 'sect' as const, eventType: 'sect.method_trained', patch: { sect: result.sect } },
        { domain: 'currency' as const, eventType: 'sect.method_cost_paid' },
      ] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/current/paths/:pathId/enroll', requireActiveCultivator(), async (c) =>
  mutateSect(c, 'sect_path_enroll', (id, tx) => SectService.enrollPath(id, c.req.param('pathId'), tx), 'sect.path_enrolled'));

router.post('/current/paths/:pathId/train', requireActiveCultivator(), validateJson(SectPathTrainRequestSchema), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const body = getValidatedJson<{ targetLevel: number }>(c);
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_path_train', run: async (tx) => {
      const result = await SectService.trainPath({ cultivatorId: cultivator.id!, pathId: c.req.param('pathId'), targetLevel: body.targetLevel }, tx);
      return { result, changes: [
        { domain: 'sect' as const, eventType: 'sect.path_trained', patch: { sect: result.sect } },
        { domain: 'currency' as const, eventType: 'sect.path_cost_paid' },
      ] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/current/paths/:pathId/activate', requireActiveCultivator(), async (c) =>
  mutateSect(c, 'sect_path_activate', (id, tx) => SectService.activatePath(id, c.req.param('pathId'), tx), 'sect.path_activated'));

router.put('/current/paths/:pathId/meridian-loadouts/:slot', requireActiveCultivator(), validateJson(SectMeridianLoadoutRequestSchema), async (c) => {
  const body = getValidatedJson<{ nodeIds: string[] }>(c);
  return mutateSect(c, 'sect_meridian_update', (id, tx) => SectService.setMeridianLoadout(id, c.req.param('pathId'), Number(c.req.param('slot')), body.nodeIds, tx), 'sect.meridian_updated');
});

router.post('/current/paths/:pathId/meridian-loadouts/:slot/activate', requireActiveCultivator(), async (c) =>
  mutateSect(c, 'sect_meridian_activate', (id, tx) => SectService.activateMeridianLoadout(id, c.req.param('pathId'), Number(c.req.param('slot')), tx), 'sect.meridian_activated'));

router.put('/current/ability-loadout', requireActiveCultivator(), validateJson(SectAbilityLoadoutRequestSchema), async (c) => {
  const body = getValidatedJson<{ abilityIds: Array<string | null> }>(c);
  return mutateSect(c, 'sect_ability_loadout', (id, tx) => SectService.setAbilityLoadout(id, body.abilityIds, tx), 'sect.ability_loadout_updated', true);
});

router.put('/current/paths/:pathId/tactic', requireActiveCultivator(), validateJson(SectTacticRequestSchema), async (c) => {
  const body = getValidatedJson<{ tacticId: string }>(c);
  return mutateSect(c, 'sect_tactic', (id, tx) => SectService.setPathTactic(id, c.req.param('pathId'), body.tacticId, tx), 'sect.tactic_updated');
});

router.post('/current/commissions/spar', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const runtime = await getPlayerRuntimeCultivatorById(user.id, cultivator.id, getExecutor());
    if (!runtime) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const battle = simulateBattleV5(runtime, { ...runtime, id: `${cultivator.id}-spar`, name: '宗门演武傀儡' });
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_commission_spar', allowEmpty: true, run: async (tx) => {
      const completed = await SectCommissionService.recordEvent(cultivator.id!, 'spar', tx);
      return { result: { completed, battle }, changes: completed ? [{ domain: 'sect' as const, eventType: 'sect.commission_completed' }] : [] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/current/commissions/claim', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_commission_claim', run: async (tx) => {
      const result = await SectCommissionService.claim(cultivator.id!, cultivator.realm as RealmType, tx);
      return { result, changes: [{ domain: 'sect' as const, eventType: 'sect.commission_claimed', patch: { sect: result.sect } }] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

async function mutateSect(
  c: Context<AppEnv>,
  source: string,
  run: (cultivatorId: string, tx: DbTransaction) => Promise<CultivatorSectState>,
  eventType: string,
  loadout = false,
) {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source, run: async (tx) => {
      const sect = await run(cultivator.id!, tx);
      return { result: { sect }, changes: [
        { domain: 'sect' as const, eventType, patch: { sect } },
        ...(loadout ? [{ domain: 'loadout' as const, eventType: 'sect.ability_loadout_changed' }] : []),
      ] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
}

export default router;
