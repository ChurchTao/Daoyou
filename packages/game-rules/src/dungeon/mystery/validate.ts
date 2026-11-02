import type {
  MysteryCaseFile,
  MysteryCondition,
  MysteryEffect,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import { evaluateMysteryCondition, mysteryNeighbors } from './engine.js';
import { MYSTERY_TEXT_PLACEHOLDER } from './skeleton.js';

export interface MysteryReachability {
  rooms: Set<string>;
  clues: Set<string>;
  items: Set<string>;
  flags: Set<string>;
}

/**
 * 从开局出发做不动点推演：只要条件满足就假定玩家会去做。
 * 消耗物品不回收，因此结果是“理论上能拿到”的上界。
 * 守卫按“打不过”处理：只有化解条件满足才能进入其房间；`skipGuarded` 时完全不进入。
 */
export function computeMysteryReachability(
  caseFile: MysteryCaseFile,
  options: { skipGuarded?: boolean; worstEvents?: boolean } = {},
): MysteryReachability {
  // 最坏情况：所有事件都发生，被毁的物件与离场的人物一开始就不可用。
  const lost = new Set(
    options.worstEvents
      ? (caseFile.events ?? []).flatMap((e) =>
          e.effects.flatMap((x) =>
            x.kind === 'destroy_object'
              ? [x.objectId]
              : x.kind === 'npc_leave'
                ? [x.npcId]
                : [],
          ),
        )
      : [],
  );
  const facts = {
    rooms: new Set([caseFile.startRoomId]),
    clues: new Set<string>(),
    items: new Set(caseFile.items.filter((i) => i.initial).map((i) => i.id)),
    flags: new Set<string>(),
  };
  const view = {
    clues: facts.clues,
    items: facts.items,
    flags: facts.flags,
    visited: facts.rooms,
  };
  const apply = (effects: readonly MysteryEffect[]) => {
    for (const e of effects) {
      if (e.kind === 'reveal_clue') facts.clues.add(e.clueId);
      if (e.kind === 'grant_item') facts.items.add(e.itemId);
      if (e.kind === 'set_flag') facts.flags.add(e.flag);
    }
  };
  const roomOf = (targetId: string) =>
    lost.has(targetId)
      ? undefined
      : (caseFile.objects.find((o) => o.id === targetId)?.roomId ??
        caseFile.npcs.find((n) => n.id === targetId)?.roomId);

  let size = -1;
  const total = () =>
    facts.rooms.size + facts.clues.size + facts.items.size + facts.flags.size;
  while (size !== total()) {
    size = total();
    for (const roomId of [...facts.rooms]) {
      for (const next of mysteryNeighbors(caseFile, roomId)) {
        const guards = caseFile.guards?.filter((g) => g.roomId === next.id);
        if (guards?.length && options.skipGuarded) continue;
        if (
          evaluateMysteryCondition(next.requires, view) &&
          (guards ?? []).every((g) => evaluateMysteryCondition(g.bypass, view))
        )
          facts.rooms.add(next.id);
      }
    }
    for (const clue of caseFile.clues) {
      const at = clue.foundAt;
      if (!at) continue;
      const room = roomOf(at.objectId);
      if (
        room &&
        facts.rooms.has(room) &&
        evaluateMysteryCondition(at.requires, view)
      )
        facts.clues.add(clue.id);
    }
    for (const item of caseFile.items) {
      const at = item.foundAt;
      if (!at) continue;
      const room = roomOf(at.objectId);
      if (
        room &&
        facts.rooms.has(room) &&
        evaluateMysteryCondition(at.requires, view)
      )
        facts.items.add(item.id);
    }
    for (const npc of caseFile.npcs) {
      if (!facts.rooms.has(npc.roomId) || lost.has(npc.id)) continue;
      for (const secret of npc.secrets) {
        if (evaluateMysteryCondition(secret.requires, view))
          facts.clues.add(secret.clueId);
      }
      for (const reaction of npc.reactions) {
        if (
          facts.clues.has(reaction.evidenceId) ||
          facts.items.has(reaction.evidenceId)
        )
          apply(reaction.effects);
      }
    }
    for (const interaction of caseFile.interactions) {
      const room = roomOf(interaction.targetId);
      if (
        room &&
        facts.rooms.has(room) &&
        facts.items.has(interaction.itemId) &&
        evaluateMysteryCondition(interaction.requires, view)
      )
        apply(interaction.effects);
    }
  }
  return facts;
}

function conditionRefs(condition: MysteryCondition | undefined): {
  clues: string[];
  items: string[];
  rooms: string[];
} {
  const refs = {
    clues: [] as string[],
    items: [] as string[],
    rooms: [] as string[],
  };
  const walk = (c: MysteryCondition | undefined) => {
    if (!c) return;
    if ('has_clue' in c) refs.clues.push(c.has_clue);
    else if ('has_item' in c) refs.items.push(c.has_item);
    else if ('visited' in c) refs.rooms.push(c.visited);
    else if ('all' in c) c.all.forEach(walk);
    else if ('any' in c) c.any.forEach(walk);
  };
  walk(condition);
  return refs;
}

function inRange(value: number, [min, max]: readonly [number, number]) {
  return value >= min && value <= max;
}

/** 估算最短通关所需行动力：移动、搜查、对话与交互各计一次。 */
export function estimateMysteryMinimumActions(caseFile: MysteryCaseFile) {
  const keyClues = new Set(
    caseFile.clues.filter((c) => c.key).map((c) => c.id),
  );
  const searchObjects = new Set(
    [...caseFile.clues, ...caseFile.items]
      .map((x) => x.foundAt?.objectId)
      .filter((id): id is string => Boolean(id)),
  );
  const talkNpcs = caseFile.npcs.filter(
    (n) =>
      n.secrets.some((s) => keyClues.has(s.clueId)) ||
      n.reactions.some((r) => r.effects.length > 0),
  ).length;
  const reactions = caseFile.npcs.reduce(
    (sum, n) => sum + n.reactions.filter((r) => r.effects.length > 0).length,
    0,
  );
  return (
    caseFile.rooms.length -
    1 +
    (caseFile.guards?.length ?? 0) +
    searchObjects.size +
    talkNpcs +
    reactions +
    caseFile.interactions.length
  );
}

/** 返回全部问题；空数组表示案卷可用。 */
export function validateMysteryCase(
  caseFile: MysteryCaseFile,
  template: MysteryScenarioTemplate,
): string[] {
  const issues: string[] = [];
  const unique = (label: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) issues.push(`${label} id 重复：${id}`);
      seen.add(id);
    }
    return seen;
  };
  const rooms = unique(
    '房间',
    caseFile.rooms.map((r) => r.id),
  );
  const objects = unique(
    '物件',
    caseFile.objects.map((o) => o.id),
  );
  const clues = unique(
    '线索',
    caseFile.clues.map((c) => c.id),
  );
  const items = unique(
    '物品',
    caseFile.items.map((i) => i.id),
  );
  const npcs = unique(
    '人物',
    caseFile.npcs.map((n) => n.id),
  );
  const all = [...rooms, ...objects, ...clues, ...items, ...npcs];
  if (new Set(all).size !== all.length)
    issues.push('房间、物件、线索、物品、人物之间的 id 不能重名');

  if (caseFile.templateId !== template.id)
    issues.push(`案卷模板 ${caseFile.templateId} 与 ${template.id} 不符`);
  if (!rooms.has(caseFile.startRoomId)) issues.push('起始房间不存在');

  const scale = template.scale;
  const keyClues = caseFile.clues.filter((c) => c.key);
  const herrings = caseFile.clues.filter((c) => !c.key);
  if (!inRange(caseFile.rooms.length, scale.rooms))
    issues.push(`房间数应在 ${scale.rooms.join('–')} 之间`);
  if (!inRange(caseFile.npcs.length, scale.npcs))
    issues.push(`人物数应在 ${scale.npcs.join('–')} 之间`);
  if (!inRange(keyClues.length, scale.key_clues))
    issues.push(`关键线索数应在 ${scale.key_clues.join('–')} 之间`);
  if (!inRange(herrings.length, scale.red_herrings))
    issues.push(`误导线索数应在 ${scale.red_herrings.join('–')} 之间`);

  const checkCondition = (where: string, c: MysteryCondition | undefined) => {
    const refs = conditionRefs(c);
    for (const id of refs.clues)
      if (!clues.has(id)) issues.push(`${where} 引用了不存在的线索 ${id}`);
    for (const id of refs.items)
      if (!items.has(id)) issues.push(`${where} 引用了不存在的物品 ${id}`);
    for (const id of refs.rooms)
      if (!rooms.has(id)) issues.push(`${where} 引用了不存在的房间 ${id}`);
  };
  const checkEffects = (where: string, effects: readonly MysteryEffect[]) => {
    for (const e of effects) {
      if (e.kind === 'reveal_clue' && !clues.has(e.clueId))
        issues.push(`${where} 揭示了不存在的线索 ${e.clueId}`);
      if (
        (e.kind === 'grant_item' || e.kind === 'consume_item') &&
        !items.has(e.itemId)
      )
        issues.push(`${where} 引用了不存在的物品 ${e.itemId}`);
    }
  };

  for (const room of caseFile.rooms) {
    for (const exit of room.exits)
      if (!rooms.has(exit))
        issues.push(`房间 ${room.id} 的出口 ${exit} 不存在`);
    checkCondition(`房间 ${room.id}`, room.requires);
    if (room.requires && !room.lockedText)
      issues.push(`房间 ${room.id} 有进入条件但缺少受阻提示`);
  }
  for (const object of caseFile.objects)
    if (!rooms.has(object.roomId))
      issues.push(`物件 ${object.id} 所在房间不存在`);
  for (const x of [...caseFile.clues, ...caseFile.items]) {
    if (x.foundAt) {
      if (!objects.has(x.foundAt.objectId))
        issues.push(`${x.id} 的发现位置 ${x.foundAt.objectId} 不存在`);
      checkCondition(`${x.id} 的发现条件`, x.foundAt.requires);
    }
  }

  const roles = new Map(template.roles.map((r) => [r.slot, 0]));
  for (const npc of caseFile.npcs) {
    if (!rooms.has(npc.roomId)) issues.push(`人物 ${npc.id} 所在房间不存在`);
    if (!roles.has(npc.role))
      issues.push(`人物 ${npc.id} 的身份 ${npc.role} 不在模板中`);
    else roles.set(npc.role, roles.get(npc.role)! + 1);
    for (const s of npc.secrets) {
      if (!clues.has(s.clueId))
        issues.push(`人物 ${npc.id} 的秘密线索 ${s.clueId} 不存在`);
      checkCondition(`人物 ${npc.id} 的秘密`, s.requires);
    }
    for (const r of npc.reactions) {
      if (!clues.has(r.evidenceId) && !items.has(r.evidenceId))
        issues.push(`人物 ${npc.id} 的反应证据 ${r.evidenceId} 不存在`);
      checkEffects(`人物 ${npc.id} 的反应`, r.effects);
    }
  }
  for (const role of template.roles) {
    if (!inRange(roles.get(role.slot) ?? 0, role.count))
      issues.push(`身份 ${role.label} 的人数应在 ${role.count.join('–')} 之间`);
  }
  for (const i of caseFile.interactions) {
    if (!items.has(i.itemId)) issues.push(`交互 ${i.id} 的物品不存在`);
    if (!objects.has(i.targetId) && !npcs.has(i.targetId))
      issues.push(`交互 ${i.id} 的目标不存在`);
    checkCondition(`交互 ${i.id}`, i.requires);
    checkEffects(`交互 ${i.id}`, i.effects);
  }
  const guardRooms = new Set<string>();
  for (const g of caseFile.guards ?? []) {
    if (!rooms.has(g.roomId)) issues.push(`守卫 ${g.id} 所在房间不存在`);
    if (g.roomId === caseFile.startRoomId)
      issues.push(`守卫 ${g.id} 不能守入口`);
    if (guardRooms.has(g.roomId)) issues.push(`房间 ${g.roomId} 有多个守卫`);
    guardRooms.add(g.roomId);
    checkCondition(`守卫 ${g.id} 的化解条件`, g.bypass);
  }
  unique(
    '守卫',
    (caseFile.guards ?? []).map((g) => g.id),
  );
  for (const rel of caseFile.brief.relations)
    if (!npcs.has(rel.npcId))
      issues.push(`角色本关系引用了不存在的人物 ${rel.npcId}`);

  const reach = computeMysteryReachability(caseFile);
  for (const room of caseFile.rooms)
    if (!reach.rooms.has(room.id)) issues.push(`房间 ${room.id} 无法到达`);
  for (const clue of keyClues)
    if (!reach.clues.has(clue.id)) issues.push(`关键线索 ${clue.id} 无法获得`);
  for (const clue of caseFile.clues) {
    const sources =
      (clue.foundAt ? 1 : 0) +
      caseFile.npcs.filter((n) => n.secrets.some((s) => s.clueId === clue.id))
        .length +
      [
        ...caseFile.interactions,
        ...caseFile.npcs.flatMap((n) => n.reactions),
      ].filter((x) =>
        x.effects.some((e) => e.kind === 'reveal_clue' && e.clueId === clue.id),
      ).length;
    if (sources === 0) issues.push(`线索 ${clue.id} 没有获取途径`);
  }

  for (const e of caseFile.events ?? []) {
    if (e.warnAt >= e.at) issues.push(`事件 ${e.id} 的预兆须早于发生`);
    if (e.at > template.scale.action_budget)
      issues.push(`事件 ${e.id} 发生得晚于行动力预算`);
    checkCondition(`事件 ${e.id} 的阻止条件`, e.unless);
    for (const x of e.effects) {
      if (x.kind === 'destroy_object' && !objects.has(x.objectId))
        issues.push(`事件 ${e.id} 毁去的物件 ${x.objectId} 不存在`);
      if (x.kind === 'npc_leave' && !npcs.has(x.npcId))
        issues.push(`事件 ${e.id} 离场的人物 ${x.npcId} 不存在`);
    }
  }
  unique(
    '事件',
    (caseFile.events ?? []).map((e) => e.id),
  );

  // 最坏情况下（不进任何守卫房间、所有事件都已发生）每个结案问题仍有关键线索支撑：
  // 守卫与事件只影响加分，不让案子无解。
  if (caseFile.guards?.length || caseFile.events?.length) {
    const worst = computeMysteryReachability(caseFile, {
      skipGuarded: true,
      worstEvents: true,
    });
    for (const tq of template.questions)
      if (
        !keyClues.some(
          (c) => c.supports.includes(tq.id) && worst.clues.has(c.id),
        )
      )
        issues.push(`结案问题 ${tq.id} 在守卫与事件的最坏情况下失去支撑`);
  }

  const questions = new Map(caseFile.questions.map((q) => [q.id, q]));
  for (const tq of template.questions) {
    const q = questions.get(tq.id);
    if (!q) {
      issues.push(`缺少结案问题 ${tq.id}`);
      continue;
    }
    const supporting = keyClues.filter(
      (c) => c.supports.includes(tq.id) && reach.clues.has(c.id),
    );
    if (supporting.length === 0)
      issues.push(`结案问题 ${tq.id} 没有可获得的关键线索支撑`);
    if (tq.answer_kind === 'npc' && !npcs.has(q.answer))
      issues.push(`结案问题 ${tq.id} 的答案应为人物 id`);
    if (tq.answer_kind === 'clue' && !keyClues.some((c) => c.id === q.answer))
      issues.push(`结案问题 ${tq.id} 的答案应为关键线索 id`);
    if (tq.answer_kind === 'choice') {
      if (!q.options || q.options.length < 2)
        issues.push(`结案问题 ${tq.id} 至少需要两个选项`);
      else if (!q.options.some((o) => o.id === q.answer))
        issues.push(`结案问题 ${tq.id} 的答案不在选项中`);
      const labels = q.options
        ?.map((o) => o.label)
        .filter((label) => label !== MYSTERY_TEXT_PLACEHOLDER);
      if (labels && new Set(labels).size !== labels.length)
        issues.push(`结案问题 ${tq.id} 的选项说法有重复`);
      if (labels?.some((label) => /[伪假]/.test(label)))
        issues.push(`结案问题 ${tq.id} 的选项说法透露了对错`);
    }
  }
  if (caseFile.questions.length !== template.questions.length)
    issues.push('结案问题与模板数量不一致');
  for (const clue of caseFile.clues)
    for (const qid of clue.supports)
      if (!questions.has(qid))
        issues.push(`线索 ${clue.id} 支撑的问题 ${qid} 不存在`);

  for (const branch of template.branches) {
    if (branch.kind === 'flag' && !reach.flags.has(branch.flag))
      issues.push(`分支 ${branch.id} 的标记 ${branch.flag} 无法达成`);
    if (
      branch.kind === 'expose_all_lies' &&
      !caseFile.npcs.some((n) => n.reactions.some((r) => r.exposesLie))
    )
      issues.push(`分支 ${branch.id} 需要至少一个可戳穿的谎言`);
  }

  const minimum = estimateMysteryMinimumActions(caseFile);
  if (minimum > template.scale.action_budget * 0.75)
    issues.push(`最短路径约需 ${minimum} 次行动，超出行动力预算的四分之三`);

  return issues;
}
