import {
  applyBattleRoundResolution,
  completeBattlePresentation,
  markBattlePresentationReady,
  transitionBattleMatch,
} from '@shared/engine/battle-v5/match/BattleMatchStateMachine';
import { resolveBattleRound } from '@shared/engine/battle-v5/round/BattleRoundResolver';
import {
  BattleClientMessageSchema,
  BattleServerMessageSchema,
} from '@shared/contracts/onlineBattle';
import {
  createBattlePresentationWindow,
  createBattleRoundPlaybackPlan,
  compactBattlePresentationWindow,
} from '@shared/online-battle/BattlePresentation';
import { createBattlePublicSnapshot } from '@shared/engine/battle-v5/match/BattlePublicSnapshot';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import {
  MAX_COMMANDS_PER_WINDOW,
  MAX_SOCKET_MESSAGE_BYTES,
  OnlineBattleCommandRateWindow,
  onlineBattleMessageByteLength,
} from '@server/lib/services/OnlineBattleSocketPolicy';
import {
  basicIntentsForPlayer,
  createOnlineBattleFixture,
} from './online-battle-fixture';

let largestResultBytes = 0;
let slowestResolutionMs = 0;
for (const teamSize of [2, 4] as const) {
  let state = createOnlineBattleFixture(
    `smoke-${teamSize}v${teamSize}`,
    teamSize,
    { onePlayerPerUnit: teamSize === 4 },
  );
  for (const controller of state.controllers) {
    state = transitionBattleMatch(state, {
      type: 'commit_player_intents',
      matchId: state.matchId,
      requestId: crypto.randomUUID(),
      playerId: controller.playerId,
      expectedMatchRevision: state.revision,
      expectedCheckpointRevision: state.battle.checkpoint.checkpointRevision,
      intents: basicIntentsForPlayer(state, controller.playerId),
    }, Date.now()).state;
  }
  assert(state.status === 'resolving', `${teamSize}v${teamSize} did not seal`);
  const resolutionStartedAt = performance.now();
  const resolution = resolveBattleRound(state.battle, state.resolving!.commandSet);
  slowestResolutionMs = Math.max(
    slowestResolutionMs,
    performance.now() - resolutionStartedAt,
  );
  const rawPlan = createBattleRoundPlaybackPlan({
    commandSetId: resolution.commandSetId,
    round: resolution.round,
    outcome: resolution.outcome,
    sequences: resolution.sequences,
  });
  const presentationStartedAt = Date.now();
  const window = compactBattlePresentationWindow(createBattlePresentationWindow({
    resultId: `result:${resolution.commandSetId}`,
    startedAt: presentationStartedAt,
    startingPublicSnapshot: createBattlePublicSnapshot(state.battle),
    plan: rawPlan,
  }));
  state = applyBattleRoundResolution(
    state,
    resolution,
    presentationStartedAt,
    window,
  );
  assert(state.status === 'presenting', `${teamSize}v${teamSize} did not present`);
  for (const controller of state.controllers) {
    state = markBattlePresentationReady(
      state,
      controller.playerId,
      window.resultId,
      window.readyAcceptedAt,
    );
  }
  state = completeBattlePresentation(state, window.scheduledEndsAt);
  assert(
    state.status === 'planning' || state.status === 'finished',
    `${teamSize}v${teamSize} did not leave presentation`,
  );
  const payloadBytes = Buffer.byteLength(JSON.stringify(window));
  largestResultBytes = Math.max(largestResultBytes, payloadBytes);
  assert(payloadBytes < 256 * 1024, `${teamSize}v${teamSize} result exceeds budget`);
}
assert(slowestResolutionMs < 3_000, 'deterministic resolution exceeded Worker budget');

{
  const state = createOnlineBattleFixture('smoke-timeout', 2);
  const timedOut = transitionBattleMatch(state, {
    type: 'resolve_planning_timeout',
    matchId: state.matchId,
    requestId: crypto.randomUUID(),
    expectedMatchRevision: state.revision,
    expectedCheckpointRevision: state.battle.checkpoint.checkpointRevision,
  }, state.planning!.deadlineAt).state;
  assert(timedOut.status === 'resolving', 'planning timeout did not seal');
  assert(
    Object.values(timedOut.resolving!.commandSet.intents).every(
      (intent) => intent.submittedBy === 'timeout',
    ),
    'planning timeout did not generate server defaults',
  );
}

const validRequestId = crypto.randomUUID();
assert(!BattleClientMessageSchema.safeParse({
  protocolVersion: 1,
  type: 'time.ping',
  requestId: validRequestId,
  clientSentAt: Date.now(),
}).success, 'V1 client message was accepted');
assert(!BattleClientMessageSchema.safeParse({
  protocolVersion: 2,
  type: 'round.submit',
  requestId: validRequestId,
  matchId: 'smoke',
  round: 1,
  checkpointRevision: 0,
  intents: Object.fromEntries(Array.from({ length: 5 }, (_, index) => [
    `unit-${index}`,
    { kind: 'basic_attack', targetUnitId: 'enemy' },
  ])),
}).success, 'oversized intent set was accepted');
assert(!BattleServerMessageSchema.safeParse({
  type: 'time.pong',
  payload: { requestId: validRequestId, clientSentAt: 1 },
}).success, 'invalid server response was accepted');

process.env.PUBLIC_WEB_ORIGINS = 'https://client.example.com';
assert(isAllowedRealtimeOrigin('https://client.example.com'),
  'configured realtime origin was rejected');
assert(!isAllowedRealtimeOrigin('https://attacker.example.com'),
  'unconfigured realtime origin was accepted');
assert(
  onlineBattleMessageByteLength('x'.repeat(MAX_SOCKET_MESSAGE_BYTES + 1)) >
    MAX_SOCKET_MESSAGE_BYTES,
  'oversized WebSocket message escaped byte budget',
);
const rateWindow = new OnlineBattleCommandRateWindow(1_000);
for (let index = 0; index < MAX_COMMANDS_PER_WINDOW; index += 1) {
  assert(rateWindow.accept(1_001), 'valid command rate was rejected');
}
assert(!rateWindow.accept(1_001), 'command rate overflow was accepted');
assert(rateWindow.accept(6_000), 'command rate window did not reset');

console.info('online battle deterministic smoke passed', {
  largestResultBytes,
  slowestResolutionMs: Math.round(slowestResolutionMs * 100) / 100,
});

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
