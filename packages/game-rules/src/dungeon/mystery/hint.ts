import type {
  MysteryCaseFile,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  evaluateMysteryCondition,
  mysteryGuardAt,
  mysteryMechanismState,
  mysteryNeighbors,
  mysteryNpcPresent,
} from './engine.js';

/** 不经锁住的门、也不经未通过的守卫，此刻能走到的房间。 */
function reachableRooms(caseFile: MysteryCaseFile, run: MysteryRunState) {
  const rooms = new Set([run.location]);
  const queue = [run.location];
  while (queue.length) {
    for (const next of mysteryNeighbors(caseFile, queue.shift()!)) {
      if (
        rooms.has(next.id) ||
        !evaluateMysteryCondition(next.requires, run) ||
        run.sealedRooms?.includes(next.id) ||
        mysteryGuardAt(caseFile, run, next.id)
      )
        continue;
      rooms.add(next.id);
      queue.push(next.id);
    }
  }
  return rooms;
}

/**
 * 静思：从此刻马上能做、且能推进案情的事里挑一件，给一句方向性提示。
 * 只指地点、人物或物品，不说出线索内容。优先补证据最少的结案问题，
 * 同一房间里的事排在前面；都没有时提示提交推理。
 */
export function mysteryHint(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
): string {
  const rooms = reachableRooms(caseFile, run);
  const roomName = (id: string) =>
    caseFile.rooms.find((r) => r.id === id)?.name ?? '';
  const found = (questionId: string) =>
    caseFile.clues.filter(
      (c) =>
        c.key && c.supports.includes(questionId) && run.clues.includes(c.id),
    ).length;
  // 线索的紧要程度：它支撑的问题里，已掌握证据最少的那个。
  const urgency = (clueId: string) => {
    const clue = caseFile.clues.find((c) => c.id === clueId);
    if (!clue?.key) return 99;
    return Math.min(...clue.supports.map(found), 50);
  };
  const candidates: Array<{ rank: number; text: string }> = [];
  const add = (rank: number, roomId: string, text: string) =>
    candidates.push({
      rank: rank * 2 + (roomId === run.location ? 0 : 1),
      text,
    });

  for (const clue of caseFile.clues) {
    // 误导线索不当作提示，免得把人往岔路上引。
    if (!clue.key || run.clues.includes(clue.id) || !clue.foundAt) continue;
    const object = caseFile.objects.find(
      (o) => o.id === clue.foundAt!.objectId,
    );
    if (
      !object ||
      run.destroyed?.includes(object.id) ||
      !rooms.has(object.roomId) ||
      !evaluateMysteryCondition(clue.foundAt.requires, run)
    )
      continue;
    add(
      urgency(clue.id),
      object.roomId,
      object.roomId === run.location
        ? run.searched.includes(object.id)
          ? `再看看${object.name}，也许会有新的发现。`
          : `此处的${object.name}，值得细看。`
        : `${roomName(object.roomId)}或许还藏着你没留意的东西。`,
    );
  }
  for (const npc of caseFile.npcs) {
    if (
      !rooms.has(npc.roomId) ||
      !mysteryNpcPresent(caseFile, run, npc.id, npc.roomId)
    )
      continue;
    for (const secret of npc.secrets) {
      if (
        urgency(secret.clueId) >= 99 ||
        run.clues.includes(secret.clueId) ||
        !evaluateMysteryCondition(secret.requires, run)
      )
        continue;
      add(
        urgency(secret.clueId),
        npc.roomId,
        `${npc.name}似乎还有话没说，不妨再去找${npc.name}谈谈。`,
      );
    }
    for (const reaction of npc.reactions) {
      if (
        run.firedReactions.includes(reaction.id) ||
        reaction.effects.length === 0 ||
        (!run.clues.includes(reaction.evidenceId) &&
          !run.items.includes(reaction.evidenceId))
      )
        continue;
      const reveals = reaction.effects.flatMap((e) =>
        e.kind === 'reveal_clue' ? [e.clueId] : [],
      );
      add(
        Math.min(40, ...reveals.map(urgency)),
        npc.roomId,
        `把你找到的东西给${npc.name}看看，也许会有所触动。`,
      );
    }
  }
  for (const interaction of caseFile.interactions) {
    if (
      run.firedInteractions.includes(interaction.id) ||
      !run.items.includes(interaction.itemId) ||
      !evaluateMysteryCondition(interaction.requires, run)
    )
      continue;
    const targetRoom =
      caseFile.objects.find((o) => o.id === interaction.targetId)?.roomId ??
      caseFile.npcs.find((n) => n.id === interaction.targetId)?.roomId;
    if (!targetRoom || !rooms.has(targetRoom)) continue;
    const reveals = interaction.effects.flatMap((e) =>
      e.kind === 'reveal_clue' ? [e.clueId] : [],
    );
    const item = caseFile.items.find((i) => i.id === interaction.itemId);
    add(
      Math.min(40, ...reveals.map(urgency)),
      targetRoom,
      `你身上的${item?.name ?? '东西'}，也许能派上用场。`,
    );
  }
  // 机关：提示都已到手、尚未开启也未锁死时，提醒去试。
  for (const m of caseFile.mechanisms ?? []) {
    if (m.final) continue;
    const state = mysteryMechanismState(run, m.id);
    const object = caseFile.objects.find((o) => o.id === m.objectId);
    if (
      state.solved ||
      state.locked ||
      !object ||
      run.destroyed?.includes(object.id) ||
      !rooms.has(object.roomId) ||
      !m.hints.every((h) => run.clues.includes(h.clueId))
    )
      continue;
    add(
      5,
      object.roomId,
      object.roomId === run.location
        ? `${object.name}的门道你已摸清，不妨一试。`
        : `${roomName(object.roomId)}的机关，你已有头绪。`,
    );
  }
  for (const item of caseFile.items) {
    if (run.items.includes(item.id) || !item.foundAt) continue;
    const object = caseFile.objects.find(
      (o) => o.id === item.foundAt!.objectId,
    );
    if (
      !object ||
      run.destroyed?.includes(object.id) ||
      !rooms.has(object.roomId) ||
      !evaluateMysteryCondition(item.foundAt.requires, run)
    )
      continue;
    add(
      45,
      object.roomId,
      object.roomId === run.location
        ? `此处的${object.name}，值得细看。`
        : `${roomName(object.roomId)}或许有用得上的东西。`,
    );
  }
  for (const room of rooms)
    if (!run.visited.includes(room))
      add(60, room, `你还没去过${roomName(room)}。`);

  candidates.sort((a, b) => a.rank - b.rank);
  return (
    candidates[0]?.text ??
    '眼下的线索已经够用了，对照案情板想一想，然后提交推理。'
  );
}
