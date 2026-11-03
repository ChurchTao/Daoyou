import type {
  MysteryCaseFile,
  MysteryMapRoom,
  MysteryNpcStatus,
  MysteryPlayerView,
  MysteryRecord,
  MysteryRunState,
  MysteryScenarioTemplate,
  MysterySourceRef,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  evaluateMysteryCondition,
  mysteryGuardAt,
  mysteryMechanismState,
  mysteryNeighbors,
} from './engine.js';
import { MECHANISM_MAX_FAILURES } from './mechanism.js';

/**
 * 线索的来源：按玩家实际可能的获取方式依次判断（搜查过的物件、交谈过的人、
 * 回应过证据的人、用过的物品交互），都对不上时取第一个可能的来源。
 */
function clueSource(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  clueId: string,
): MysterySourceRef | undefined {
  const place = (roomId: string | undefined) => {
    const room = caseFile.rooms.find((r) => r.id === roomId);
    return room
      ? { kind: 'place' as const, id: room.id, name: room.name }
      : undefined;
  };
  const person = (npcId: string) => {
    const npc = caseFile.npcs.find((n) => n.id === npcId);
    return npc
      ? { kind: 'person' as const, id: npc.id, name: npc.name }
      : undefined;
  };
  const clue = caseFile.clues.find((c) => c.id === clueId);
  const object = caseFile.objects.find((o) => o.id === clue?.foundAt?.objectId);
  const fromSecret = caseFile.npcs.find((n) =>
    n.secrets.some((x) => x.clueId === clueId),
  );
  const fromReaction = caseFile.npcs.find((n) =>
    n.reactions.some((r) =>
      r.effects.some((e) => e.kind === 'reveal_clue' && e.clueId === clueId),
    ),
  );
  const interaction = caseFile.interactions.find((i) =>
    i.effects.some((e) => e.kind === 'reveal_clue' && e.clueId === clueId),
  );
  const interactionPlace = () =>
    interaction &&
    (place(
      caseFile.objects.find((o) => o.id === interaction.targetId)?.roomId,
    ) ??
      person(interaction.targetId));
  if (object && run.searched.includes(object.id)) return place(object.roomId);
  if (fromSecret && run.talkedTo.includes(fromSecret.id))
    return person(fromSecret.id);
  if (
    fromReaction &&
    fromReaction.reactions.some((r) => run.firedReactions.includes(r.id))
  )
    return person(fromReaction.id);
  if (interaction && run.firedInteractions.includes(interaction.id))
    return interactionPlace();
  return (
    (object && place(object.roomId)) ??
    (fromSecret && person(fromSecret.id)) ??
    (fromReaction && person(fromReaction.id)) ??
    interactionPlace()
  );
}

function npcStatus(
  npc: MysteryCaseFile['npcs'][number],
  run: MysteryRunState,
): MysteryNpcStatus {
  const fired = npc.reactions.filter((r) => run.firedReactions.includes(r.id));
  if (run.departed?.includes(npc.id)) return 'departed';
  if (fired.some((r) => r.exposesLie)) return 'exposed';
  if (fired.length > 0) return 'opened';
  return run.talkedTo.includes(npc.id) ? 'talked' : 'unmet';
}

/** 已知地点的示意：到访过的房间与其相邻房间，按距入口的步数分层。 */
function projectMap(caseFile: MysteryCaseFile, run: MysteryRunState) {
  const known = new Set(run.visited);
  for (const id of run.visited)
    for (const next of mysteryNeighbors(caseFile, id)) known.add(next.id);
  const depth = new Map([[caseFile.startRoomId, 0]]);
  const queue = [caseFile.startRoomId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of mysteryNeighbors(caseFile, id)) {
      if (depth.has(next.id)) continue;
      depth.set(next.id, depth.get(id)! + 1);
      queue.push(next.id);
    }
  }
  const rooms: MysteryMapRoom[] = caseFile.rooms
    .filter((r) => known.has(r.id))
    .map((r) => {
      const visited = run.visited.includes(r.id);
      const objects = caseFile.objects.filter(
        (o) => o.roomId === r.id && !run.destroyed?.includes(o.id),
      );
      return {
        id: r.id,
        name: r.name,
        depth: depth.get(r.id) ?? 0,
        here: r.id === run.location,
        visited,
        locked: !evaluateMysteryCondition(r.requires, run),
        sealed: Boolean(run.sealedRooms?.includes(r.id)),
        guarded: Boolean(mysteryGuardAt(caseFile, run, r.id)),
        people: visited
          ? caseFile.npcs.filter(
              (n) => n.roomId === r.id && !run.departed?.includes(n.id),
            ).length
          : 0,
        disturbed: caseFile.objects.some(
          (o) => o.roomId === r.id && run.destroyed?.includes(o.id),
        ),
        searched: visited
          ? objects.filter((o) => run.searched.includes(o.id)).length
          : 0,
        objects: visited ? objects.length : 0,
      };
    });
  const edges: Array<[string, string]> = [];
  for (const room of caseFile.rooms)
    for (const exit of room.exits)
      if (known.has(room.id) && known.has(exit)) edges.push([room.id, exit]);
  return { rooms, edges };
}

/** 只投影玩家已经知道的内容；真相与答案仅在结案后附带。 */
export function projectMysteryView(
  record: MysteryRecord,
  template: MysteryScenarioTemplate,
): MysteryPlayerView {
  const { caseFile, run, result } = record;
  const room =
    caseFile.rooms.find((r) => r.id === run.location) ?? caseFile.rooms[0]!;
  const npcName = (id: string) =>
    caseFile.npcs.find((n) => n.id === id)?.name ?? id;
  const knownNpcIds = new Set([
    ...caseFile.brief.relations.map((r) => r.npcId),
    ...caseFile.npcs
      .filter((n) => run.visited.includes(n.roomId))
      .map((n) => n.id),
  ]);
  const labelOf = (questionId: string, answer: string) => {
    const tq = template.questions.find((q) => q.id === questionId);
    if (tq?.answer_kind === 'npc') return npcName(answer);
    if (tq?.answer_kind === 'clue')
      return caseFile.clues.find((c) => c.id === answer)?.name ?? answer;
    return (
      caseFile.questions
        .find((q) => q.id === questionId)
        ?.options?.find((o) => o.id === answer)?.label ?? answer
    );
  };

  return {
    title: caseFile.title,
    replay: record.replay ?? false,
    confrontation: Boolean(template.finale?.points),
    ...(record.pendingGuard
      ? { pendingBattle: 'guard' as const }
      : record.verdict
        ? { pendingBattle: 'finale' as const }
        : {}),
    templateName: template.name,
    brief: {
      ...caseFile.brief,
      relations: caseFile.brief.relations.map((r) => ({
        ...r,
        name: npcName(r.npcId),
      })),
    },
    turn: run.turn,
    actionBudget: run.actionBudget,
    actionsLeft: run.actionsLeft,
    location: { id: room.id, name: room.name, description: room.description },
    exits: mysteryNeighbors(caseFile, room.id).map((r) => {
      const sealed = Boolean(run.sealedRooms?.includes(r.id));
      const locked = sealed || !evaluateMysteryCondition(r.requires, run);
      const guard = locked ? undefined : mysteryGuardAt(caseFile, run, r.id);
      return {
        id: r.id,
        name: r.name,
        locked,
        ...(sealed
          ? { hint: '已被异变封住，进不去了。' }
          : locked && r.lockedText
            ? { hint: r.lockedText }
            : {}),
        ...(guard
          ? {
              guard: {
                id: guard.id,
                name: guard.name,
                description: guard.description,
                canBypass: evaluateMysteryCondition(guard.bypass, run),
              },
            }
          : {}),
      };
    }),
    objects: caseFile.objects
      .filter((o) => o.roomId === room.id && !run.destroyed?.includes(o.id))
      .map((o) => {
        const m = caseFile.mechanisms?.find(
          (x) => x.objectId === o.id && !x.final,
        );
        const state = m ? mysteryMechanismState(run, m.id) : undefined;
        return {
          id: o.id,
          name: o.name,
          searched: run.searched.includes(o.id),
          ...(m && state
            ? {
                mechanism: {
                  id: m.id,
                  name: m.name,
                  parts: m.parts,
                  failures: state.failures,
                  maxFailures: MECHANISM_MAX_FAILURES,
                  solved: state.solved,
                  locked: state.locked,
                },
              }
            : {}),
        };
      }),
    npcsHere: caseFile.npcs
      .filter((n) => n.roomId === room.id && !run.departed?.includes(n.id))
      .map((n) => ({ id: n.id, name: n.name, title: n.title })),
    knownNpcs: caseFile.npcs
      .filter((n) => knownNpcIds.has(n.id))
      .map((n) => {
        const status = npcStatus(n, run);
        const room =
          status !== 'departed' && run.visited.includes(n.roomId)
            ? caseFile.rooms.find((r) => r.id === n.roomId)
            : undefined;
        const lastLine = run.log.findLast(
          (e) => e.kind === 'speech' && e.speaker === n.name,
        )?.text;
        return {
          id: n.id,
          name: n.name,
          title: n.title,
          status,
          ...(room ? { roomId: room.id, roomName: room.name } : {}),
          ...(lastLine ? { lastLine } : {}),
        };
      }),
    clues: run.clues.flatMap((id) => {
      const c = caseFile.clues.find((x) => x.id === id);
      if (!c) return [];
      const source = clueSource(caseFile, run, c.id);
      return [
        { id: c.id, name: c.name, text: c.text, ...(source ? { source } : {}) },
      ];
    }),
    items: run.items.flatMap((id) => {
      const i = caseFile.items.find((x) => x.id === id);
      if (!i) return [];
      const room = caseFile.rooms.find(
        (r) =>
          r.id ===
          caseFile.objects.find((o) => o.id === i.foundAt?.objectId)?.roomId,
      );
      return [
        {
          id: i.id,
          name: i.name,
          text: i.text,
          ...(room
            ? {
                source: {
                  kind: 'place' as const,
                  id: room.id,
                  name: room.name,
                },
              }
            : {}),
        },
      ];
    }),
    alerts: (caseFile.events ?? [])
      .filter(
        (e) =>
          run.events?.includes(`warn:${e.id}`) &&
          !run.events.includes(e.id) &&
          !evaluateMysteryCondition(e.unless, run),
      )
      .map((e) => ({ id: e.id, text: e.warning })),
    map: projectMap(caseFile, run),
    log: run.log,
    questions: template.questions.map((tq) => {
      const q = caseFile.questions.find((x) => x.id === tq.id);
      return {
        id: tq.id,
        prompt: tq.prompt,
        kind: tq.answer_kind,
        ...(tq.answer_kind === 'choice' && q?.options
          ? { options: q.options }
          : {}),
        ...(tq.judgement ? { judgement: true } : {}),
      };
    }),
    ...(result
      ? {
          result: {
            ...result,
            truth: caseFile.truth,
            explanations: caseFile.questions.map((q) => {
              const tq = template.questions.find((x) => x.id === q.id);
              // 抉择题展示玩家自己的选择，没有标准答案。
              return {
                questionId: q.id,
                prompt: tq?.prompt ?? q.id,
                answerLabel: labelOf(
                  q.id,
                  tq?.judgement ? (result.answers[q.id] ?? q.answer) : q.answer,
                ),
                explanation: q.explanation,
                ...(tq?.judgement ? { judgement: true } : {}),
              };
            }),
          },
        }
      : {}),
  };
}
