import type {
  BattleCommandReceiptV1,
  BattleControllerV1,
  BattleMatchStateV1,
} from '../engine/battle-v5/match/types';
import { validateBattleSave } from '../engine/battle-v5/persistence/BattleStateCodec';
import type { CompactBattlePresentationWindowV1 } from '../online-battle/BattlePresentation';
import type { BattleReplayRoundV1 } from './battleReplay';
import type { BattleTerminalEventV1 } from './battleTerminal';

export interface OnlineBattleOrchestrationV1 {
  readonly kind: 'arena_sparring_v1';
  readonly roomId: string;
  readonly startRequestId: string;
}

export interface OnlineBattleCommandReceiptRecordV1 {
  readonly playerId: string;
  readonly requestId: string;
  readonly commandType: 'round.submit' | 'presentation.ready';
  readonly payloadHash: string;
  readonly receipt: BattleCommandReceiptV1;
}

export interface OnlineBattleRuntimeStateV1 {
  readonly version: 'online_battle_runtime_v1';
  readonly storageRevision: number;
  /** Sequence of client-visible authoritative events only. */
  readonly clientEventSeq: number;
  readonly match: BattleMatchStateV1;
  readonly acceptedPlayerIds: readonly string[];
  /** Transient hand-off to the dedicated Redis presentation blob. */
  readonly pendingPresentationWindow?: CompactBattlePresentationWindowV1;
  readonly resolutionRetry?: {
    readonly attempt: number;
    readonly nextRetryAt: number;
    readonly lastFailureCode: string;
    readonly lastFailureFingerprint: string;
    readonly firstFailedAt: number;
    readonly lastFailedAt: number;
  };
  readonly replay: {
    readonly version: 'battle_replay_accumulator_v1';
    /** Transient hand-off to the Redis replay-round list. */
    readonly pendingRound?: BattleReplayRoundV1;
  };
  readonly orchestration?: OnlineBattleOrchestrationV1;
  readonly termination?: {
    readonly reason: Exclude<
      BattleTerminalEventV1['terminalReason'],
      'battle_completed' | 'corrupt_runtime'
    >;
    readonly requestedAt: number;
  };
}

export const ONLINE_BATTLE_ACCEPT_TIMEOUT_MS = 10 * 60_000;
export const ONLINE_BATTLE_RESOLUTION_FAILURE_TIMEOUT_MS = 5 * 60_000;

export function createOnlineBattleRuntimeState(input: {
  readonly match: BattleMatchStateV1;
  readonly acceptedPlayerIds: readonly string[];
  readonly orchestration?: OnlineBattleOrchestrationV1;
}): OnlineBattleRuntimeStateV1 {
  const runtime: OnlineBattleRuntimeStateV1 = {
    version: 'online_battle_runtime_v1',
    storageRevision: 0,
    clientEventSeq: 0,
    match: input.match,
    acceptedPlayerIds: [...new Set(input.acceptedPlayerIds)].sort(),
    replay: { version: 'battle_replay_accumulator_v1' },
    ...(input.orchestration ? { orchestration: input.orchestration } : {}),
  };
  assertOnlineBattleRuntimeState(runtime);
  return runtime;
}

export function advanceOnlineBattleRuntime(
  current: OnlineBattleRuntimeStateV1,
  patch: Partial<
    Omit<OnlineBattleRuntimeStateV1, 'version' | 'storageRevision'>
  >,
): OnlineBattleRuntimeStateV1 {
  const next: OnlineBattleRuntimeStateV1 = {
    ...current,
    ...patch,
    version: 'online_battle_runtime_v1',
    storageRevision: current.storageRevision + 1,
  };
  assertOnlineBattleRuntimeState(next, {
    allowPendingReplayRound: true,
    allowPendingPresentationWindow: true,
  });
  return next;
}

/**
 * Executable persistence boundary for Redis runtime JSON. TypeScript types are
 * not trusted after serialization. Unsupported or internally inconsistent
 * states must be discarded instead of migrated or retried forever.
 */
export function assertOnlineBattleRuntimeState(
  value: unknown,
  options: {
    readonly allowPendingReplayRound?: boolean;
    readonly allowPendingPresentationWindow?: boolean;
  } = {},
): asserts value is OnlineBattleRuntimeStateV1 {
  const runtime = requireRecord(value, 'Online battle runtime');
  requireEqual(runtime.version, 'online_battle_runtime_v1', 'runtime version');
  requireNonNegativeInteger(runtime.storageRevision, 'storageRevision');
  requireNonNegativeInteger(runtime.clientEventSeq, 'clientEventSeq');

  const match = requireRecord(
    runtime.match,
    'match',
  ) as unknown as BattleMatchStateV1;
  requireEqual(match.version, 'battle_match_state_v1', 'match version');
  requireIdentifier(match.matchId, 'matchId');
  requireNonNegativeInteger(match.revision, 'match revision');
  requireFiniteNumber(match.createdAt, 'match createdAt');
  requireFiniteNumber(match.updatedAt, 'match updatedAt');
  if (match.updatedAt < match.createdAt) {
    throw new Error('Online battle match updatedAt precedes createdAt');
  }
  validateBattleSave(match.battle);

  const controllers = validateControllers(match.controllers, match);
  const controllerIds = new Set(
    controllers.map((controller) => controller.playerId),
  );
  const acceptedPlayerIds = requireUniqueIdentifiers(
    runtime.acceptedPlayerIds,
    'acceptedPlayerIds',
  );
  for (const playerId of acceptedPlayerIds) {
    if (!controllerIds.has(playerId)) {
      throw new Error('Online battle accepted player is not a controller');
    }
  }
  validateMatchPhase(runtime as unknown as OnlineBattleRuntimeStateV1);
  validateAcceptedPlayersForPhase(
    match.status,
    acceptedPlayerIds.length,
    controllers.length,
  );
  if (
    runtime.pendingPresentationWindow !== undefined &&
    options.allowPendingPresentationWindow !== true
  ) {
    throw new Error(
      'Online battle runtime contains pending presentation hand-off material',
    );
  }
  if (
    'commandReceiptsByPlayerId' in runtime ||
    'processedCommandReceipts' in runtime
  ) {
    throw new Error(
      'Online battle runtime contains obsolete embedded command receipts',
    );
  }
  validateReplay(runtime.replay, options.allowPendingReplayRound === true);
  validateOrchestration(runtime.orchestration);
  validateTermination(runtime as unknown as OnlineBattleRuntimeStateV1);
}

function validateAcceptedPlayersForPhase(
  status: BattleMatchStateV1['status'],
  acceptedPlayerCount: number,
  controllerCount: number,
): void {
  if (status === 'waiting' && acceptedPlayerCount >= controllerCount) {
    throw new Error('Online battle waiting state already has every player');
  }
  if (
    status !== 'waiting' &&
    status !== 'cancelled' &&
    acceptedPlayerCount !== controllerCount
  ) {
    throw new Error(`Online battle ${status} state does not have every player`);
  }
}

function validateTermination(runtime: OnlineBattleRuntimeStateV1): void {
  if (runtime.match.status === 'cancelled') {
    const termination = requireRecord(runtime.termination, 'termination');
    if (
      ![
        'technical_abort',
        'accept_timeout',
        'resolution_freeze_timeout',
      ].includes(String(termination.reason))
    ) {
      throw new Error('Online battle termination reason is invalid');
    }
    requireFiniteNumber(termination.requestedAt, 'termination requestedAt');
    return;
  }
  if (runtime.termination !== undefined) {
    throw new Error(
      'Online battle termination metadata exists outside cancelled',
    );
  }
}

function validateMatchPhase(runtime: OnlineBattleRuntimeStateV1): void {
  const { match } = runtime;
  if (
    runtime.pendingPresentationWindow !== undefined &&
    match.status !== 'presenting'
  ) {
    throw new Error(
      'Online battle presentation hand-off exists outside presenting',
    );
  }
  const allowedStatuses = new Set([
    'waiting',
    'planning',
    'resolving',
    'presenting',
    'resolution_failed',
    'finished',
    'cancelled',
  ]);
  if (!allowedStatuses.has(match.status)) {
    throw new Error('Online battle match status is invalid');
  }

  const hasPlanning = match.planning !== undefined;
  const hasResolving = match.resolving !== undefined;
  const hasPresentation = match.presentation !== undefined;
  const expected = {
    waiting: [false, false, false],
    planning: [true, false, false],
    resolving: [false, true, false],
    presenting: [false, false, true],
    resolution_failed: [false, true, false],
    finished: [false, false, false],
    cancelled: [false, false, false],
  }[match.status];
  if (
    !expected ||
    expected[0] !== hasPlanning ||
    expected[1] !== hasResolving ||
    expected[2] !== hasPresentation
  ) {
    throw new Error(
      `Online battle ${match.status} phase fields are inconsistent`,
    );
  }

  if (match.status === 'planning') validatePlanning(runtime);
  if (match.status === 'resolving' || match.status === 'resolution_failed') {
    validateResolving(runtime);
  }
  if (match.status === 'presenting') validatePresentation(runtime);
  if (match.status === 'resolution_failed' && !match.resolving?.failure) {
    throw new Error('Online battle resolution_failed state has no failure');
  }
  if (match.status === 'resolving' && match.resolving?.failure) {
    throw new Error(
      'Online battle resolving state still contains a terminal failure',
    );
  }
  if (runtime.resolutionRetry && match.status !== 'resolving') {
    throw new Error('Online battle retry metadata exists outside resolving');
  }
  if (runtime.resolutionRetry) validateResolutionRetry(runtime.resolutionRetry);
}

function validatePlanning(runtime: OnlineBattleRuntimeStateV1): void {
  const planning = runtime.match.planning!;
  requirePositiveInteger(planning.round, 'planning round');
  requireNonNegativeInteger(
    planning.checkpointRevision,
    'planning checkpointRevision',
  );
  requireFiniteNumber(planning.opensAt, 'planning opensAt');
  requireFiniteNumber(planning.deadlineAt, 'planning deadlineAt');
  if (planning.deadlineAt <= planning.opensAt) {
    throw new Error('Online battle planning deadline is invalid');
  }
  if (
    planning.checkpointRevision !==
    runtime.match.battle.checkpoint.checkpointRevision
  ) {
    throw new Error('Online battle planning checkpoint is stale');
  }
  const controllerIds = new Set(
    runtime.match.controllers.map((entry) => entry.playerId),
  );
  for (const playerId of requireUniqueIdentifiers(
    planning.committedPlayerIds,
    'planning committedPlayerIds',
  )) {
    if (!controllerIds.has(playerId)) {
      throw new Error('Online battle committed player is not a controller');
    }
  }
  const submissions = requireRecord(
    planning.submissions,
    'planning submissions',
  );
  const controlledUnits = new Set(
    runtime.match.controllers.flatMap((entry) => entry.unitIds),
  );
  for (const [unitId, intent] of Object.entries(submissions)) {
    if (!controlledUnits.has(unitId) || !isBattleActionIntent(intent)) {
      throw new Error('Online battle planning contains an invalid submission');
    }
  }
}

function validateResolving(runtime: OnlineBattleRuntimeStateV1): void {
  const resolving = runtime.match.resolving!;
  requireFiniteNumber(resolving.startedAt, 'resolving startedAt');
  const commandSet = requireRecord(
    resolving.commandSet,
    'resolving commandSet',
  );
  requireEqual(
    commandSet.version,
    'round_command_set_v1',
    'command set version',
  );
  requireIdentifier(commandSet.commandSetId, 'commandSetId', 300);
  requirePositiveInteger(commandSet.round, 'command set round');
  requireNonNegativeInteger(
    commandSet.checkpointRevision,
    'command set checkpointRevision',
  );
  if (
    commandSet.checkpointRevision !==
    runtime.match.battle.checkpoint.checkpointRevision
  ) {
    throw new Error('Online battle resolving checkpoint is stale');
  }
  const intents = requireRecord(commandSet.intents, 'command set intents');
  const controlledUnits = new Set(
    runtime.match.controllers.flatMap((entry) => entry.unitIds),
  );
  if (Object.keys(intents).length !== controlledUnits.size) {
    throw new Error(
      'Online battle command set does not cover every controlled unit',
    );
  }
  for (const [unitId, intent] of Object.entries(intents)) {
    if (!controlledUnits.has(unitId) || !isBattleActionIntent(intent)) {
      throw new Error('Online battle command set contains an invalid intent');
    }
  }
}

function validatePresentation(runtime: OnlineBattleRuntimeStateV1): void {
  const presentation = runtime.match.presentation!;
  requireIdentifier(presentation.resultId, 'presentation resultId', 300);
  requirePositiveInteger(presentation.round, 'presentation round');
  requireFiniteNumber(presentation.startedAt, 'presentation startedAt');
  requireFiniteNumber(
    presentation.readyAcceptedAt,
    'presentation readyAcceptedAt',
  );
  requireFiniteNumber(
    presentation.scheduledEndsAt,
    'presentation scheduledEndsAt',
  );
  if (
    presentation.readyAcceptedAt < presentation.startedAt ||
    presentation.scheduledEndsAt < presentation.readyAcceptedAt
  ) {
    throw new Error('Online battle presentation timing is invalid');
  }
  const controllerIds = new Set(
    runtime.match.controllers.map((entry) => entry.playerId),
  );
  for (const playerId of requireUniqueIdentifiers(
    presentation.readyPlayerIds,
    'presentation readyPlayerIds',
  )) {
    if (!controllerIds.has(playerId)) {
      throw new Error(
        'Online battle presentation Ready player is not a controller',
      );
    }
  }
  const window = runtime.pendingPresentationWindow;
  if (window !== undefined) {
    if (
      window.protocolVersion !== 1 ||
      window.resultId !== presentation.resultId ||
      window.plan.round !== presentation.round ||
      window.startedAt !== presentation.startedAt ||
      window.readyAcceptedAt !== presentation.readyAcceptedAt ||
      window.scheduledEndsAt !== presentation.scheduledEndsAt
    ) {
      throw new Error(
        'Online battle presentation window does not match match state',
      );
    }
  }
}

function validateControllers(
  value: unknown,
  match: BattleMatchStateV1,
): readonly BattleControllerV1[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 8) {
    throw new Error('Online battle controllers are invalid');
  }
  const controllers = value as BattleControllerV1[];
  const playerIds = new Set<string>();
  const controlledUnits = new Set<string>();
  const checkpointUnits = new Set(Object.keys(match.battle.checkpoint.units));
  const teamByUnitId = new Map(
    match.battle.blueprint.teams.flatMap((team) =>
      team.units.map((unit) => [unit.id, team.id] as const),
    ),
  );
  for (const controller of controllers) {
    requireIdentifier(controller.playerId, 'controller playerId');
    requireIdentifier(controller.teamId, 'controller teamId', 32);
    if (playerIds.has(controller.playerId)) {
      throw new Error('Online battle controller player is duplicated');
    }
    playerIds.add(controller.playerId);
    const unitIds = requireUniqueIdentifiers(
      controller.unitIds,
      'controller unitIds',
    );
    if (unitIds.length < 1 || unitIds.length > 4) {
      throw new Error('Online battle controller unit count is invalid');
    }
    for (const unitId of unitIds) {
      if (
        controlledUnits.has(unitId) ||
        !checkpointUnits.has(unitId) ||
        teamByUnitId.get(unitId) !== controller.teamId
      ) {
        throw new Error('Online battle controller unit mapping is invalid');
      }
      controlledUnits.add(unitId);
    }
  }
  if (controlledUnits.size !== checkpointUnits.size) {
    throw new Error('Online battle controllers do not cover every battle unit');
  }
  return controllers;
}

function validateReplay(value: unknown, allowPendingRound: boolean): void {
  const replay = requireRecord(value, 'replay accumulator');
  requireEqual(
    replay.version,
    'battle_replay_accumulator_v1',
    'replay version',
  );
  if (replay.pendingRound !== undefined && !allowPendingRound) {
    throw new Error(
      'Persisted online battle runtime contains a pending replay round',
    );
  }
}

function validateResolutionRetry(
  value: NonNullable<OnlineBattleRuntimeStateV1['resolutionRetry']>,
): void {
  requirePositiveInteger(value.attempt, 'resolution retry attempt');
  requireFiniteNumber(value.nextRetryAt, 'resolution retry nextRetryAt');
  requireIdentifier(value.lastFailureCode, 'resolution retry failure code');
  requireIdentifier(
    value.lastFailureFingerprint,
    'resolution retry fingerprint',
  );
  requireFiniteNumber(value.firstFailedAt, 'resolution retry firstFailedAt');
  requireFiniteNumber(value.lastFailedAt, 'resolution retry lastFailedAt');
  if (
    value.lastFailedAt < value.firstFailedAt ||
    value.nextRetryAt < value.lastFailedAt
  ) {
    throw new Error('Online battle resolution retry timing is invalid');
  }
}

function validateOrchestration(value: unknown): void {
  if (value === undefined) return;
  const orchestration = requireRecord(value, 'orchestration');
  requireEqual(orchestration.kind, 'arena_sparring_v1', 'orchestration kind');
  requireIdentifier(orchestration.roomId, 'orchestration roomId');
  requireIdentifier(
    orchestration.startRequestId,
    'orchestration startRequestId',
  );
}

function isBattleActionIntent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const intent = value as Record<string, unknown>;
  if (intent.submittedBy !== 'player' && intent.submittedBy !== 'timeout')
    return false;
  if (intent.kind === 'skip') return intent.submittedBy === 'timeout';
  if (intent.kind === 'basic_attack')
    return typeof intent.targetUnitId === 'string';
  return intent.kind === 'ability' && typeof intent.abilityId === 'string';
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireEqual(value: unknown, expected: string, label: string): void {
  if (value !== expected) throw new Error(`Online battle ${label} is invalid`);
}

function requireIdentifier(
  value: unknown,
  label: string,
  max = 120,
): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > max ||
    !/^[A-Za-z0-9_:.@-]+$/.test(value)
  ) {
    throw new Error(`Online battle ${label} is invalid`);
  }
}

function requireUniqueIdentifiers(value: unknown, label: string): string[] {
  if (!Array.isArray(value))
    throw new Error(`Online battle ${label} must be an array`);
  const result = value.map((entry) => {
    requireIdentifier(entry, label);
    return entry;
  });
  if (new Set(result).size !== result.length) {
    throw new Error(`Online battle ${label} contains duplicates`);
  }
  return result;
}

function requireFiniteNumber(
  value: unknown,
  label: string,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Online battle ${label} is invalid`);
  }
}

function requireNonNegativeInteger(
  value: unknown,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`Online battle ${label} is invalid`);
  }
}

function requirePositiveInteger(
  value: unknown,
  label: string,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`Online battle ${label} is invalid`);
  }
}
