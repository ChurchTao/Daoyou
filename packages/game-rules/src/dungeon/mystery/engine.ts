import type {
  MysteryAction,
  MysteryCaseFile,
  MysteryCondition,
  MysteryEffect,
  MysteryLogEntry,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';

import { mysteryHint } from './hint.js';
import { MECHANISM_MAX_FAILURES } from './mechanism.js';

const LOG_LIMIT = 80;

/** 条件求值只读取会单调增长的事实，保证可解性推演与运行时一致。 */
export interface MysteryFacts {
  clues: ReadonlySet<string> | readonly string[];
  items: ReadonlySet<string> | readonly string[];
  flags: ReadonlySet<string> | readonly string[];
  visited: ReadonlySet<string> | readonly string[];
}

function has(values: ReadonlySet<string> | readonly string[], id: string) {
  return 'has' in values ? values.has(id) : values.includes(id);
}

export function evaluateMysteryCondition(
  condition: MysteryCondition | undefined,
  facts: MysteryFacts,
): boolean {
  if (!condition) return true;
  if ('has_clue' in condition) return has(facts.clues, condition.has_clue);
  if ('has_item' in condition) return has(facts.items, condition.has_item);
  if ('flag' in condition) return has(facts.flags, condition.flag);
  if ('visited' in condition) return has(facts.visited, condition.visited);
  if ('all' in condition)
    return condition.all.every((c) => evaluateMysteryCondition(c, facts));
  return condition.any.some((c) => evaluateMysteryCondition(c, facts));
}

/** 房间连通按无向图处理：任一侧声明出口即可往返。 */
export function mysteryNeighbors(caseFile: MysteryCaseFile, roomId: string) {
  const room = caseFile.rooms.find((r) => r.id === roomId);
  const ids = new Set(room?.exits ?? []);
  for (const other of caseFile.rooms) {
    if (other.exits.includes(roomId)) ids.add(other.id);
  }
  ids.delete(roomId);
  return caseFile.rooms.filter((r) => ids.has(r.id));
}

export function createMysteryRun(
  caseFile: MysteryCaseFile,
  actionBudget: number,
): MysteryRunState {
  const start = caseFile.rooms.find((r) => r.id === caseFile.startRoomId);
  return {
    turn: 0,
    actionBudget,
    actionsLeft: actionBudget,
    location: caseFile.startRoomId,
    visited: [caseFile.startRoomId],
    searched: [],
    clues: [],
    items: caseFile.items.filter((i) => i.initial).map((i) => i.id),
    flags: [],
    talkedTo: [],
    firedReactions: [],
    firedInteractions: [],
    log: [
      { turn: 0, kind: 'scene', text: caseFile.brief.opening },
      ...(start
        ? [{ turn: 0, kind: 'scene' as const, text: start.description }]
        : []),
    ],
  };
}

export type MysteryActionResult =
  | { ok: true; run: MysteryRunState; newClues: string[] }
  | { ok: false; error: string };

function cloneRun(run: MysteryRunState): MysteryRunState {
  return {
    ...run,
    visited: [...run.visited],
    searched: [...run.searched],
    clues: [...run.clues],
    items: [...run.items],
    flags: [...run.flags],
    talkedTo: [...run.talkedTo],
    firedReactions: [...run.firedReactions],
    firedInteractions: [...run.firedInteractions],
    log: [...run.log],
    ...(run.passedGuards ? { passedGuards: [...run.passedGuards] } : {}),
    ...(run.events ? { events: [...run.events] } : {}),
    ...(run.destroyed ? { destroyed: [...run.destroyed] } : {}),
    ...(run.departed ? { departed: [...run.departed] } : {}),
    ...(run.sealedRooms ? { sealedRooms: [...run.sealedRooms] } : {}),
    ...(run.mechanisms
      ? {
          mechanisms: Object.fromEntries(
            Object.entries(run.mechanisms).map(([k, v]) => [k, { ...v }]),
          ),
        }
      : {}),
  };
}

/** 机关当前状态；尚未操作过的视为全新。 */
export function mysteryMechanismState(run: MysteryRunState, id: string) {
  return run.mechanisms?.[id] ?? { failures: 0, solved: false, locked: false };
}

/** 人物此刻是否在该房间：离场的人物不再出现。 */
export function mysteryNpcPresent(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  npcId: string,
  roomId = run.location,
) {
  return caseFile.npcs.find(
    (n) =>
      n.id === npcId && n.roomId === roomId && !run.departed?.includes(n.id),
  );
}

/**
 * 推进随回合发生的事件：到预兆回合记一条预兆，到发生回合执行后果。
 * 阻止条件在预兆或发生前已满足的事件不再推进；每个事件的预兆与发生各只一次。
 */
function advanceMysteryEvents(w: RunWriter) {
  const run = w.run;
  for (const event of w.caseFile.events ?? []) {
    const seen = run.events ?? [];
    if (seen.includes(event.id)) continue;
    if (evaluateMysteryCondition(event.unless, run)) continue;
    if (run.turn >= event.at) {
      run.events = [...seen, event.id];
      w.log({ kind: 'event', text: event.text });
      for (const effect of event.effects) {
        if (effect.kind === 'destroy_object')
          run.destroyed = [...(run.destroyed ?? []), effect.objectId];
        else if (effect.kind === 'npc_leave')
          run.departed = [...(run.departed ?? []), effect.npcId];
        else if (effect.kind === 'seal_room') {
          if (!run.sealedRooms?.includes(effect.roomId))
            run.sealedRooms = [...(run.sealedRooms ?? []), effect.roomId];
        } else if (effect.kind === 'lock_mechanism') {
          const state = mysteryMechanismState(run, effect.mechanismId);
          if (!state.solved)
            run.mechanisms = {
              ...run.mechanisms,
              [effect.mechanismId]: { ...state, locked: true },
            };
        } else if (!run.flags.includes(effect.flag))
          run.flags.push(effect.flag);
      }
    } else if (run.turn >= event.warnAt && !seen.includes(`warn:${event.id}`)) {
      run.events = [...seen, `warn:${event.id}`];
      w.log({ kind: 'omen', text: event.warning });
    }
  }
}

/** 动作收尾：推进事件、提示行动力耗尽、截断日志。 */
function finishTurn(w: RunWriter): MysteryActionResult {
  advanceMysteryEvents(w);
  if (w.run.actionsLeft === 0)
    w.log({ kind: 'system', text: '行动力已尽，该给出你的推断了。' });
  w.run.log = w.run.log.slice(-LOG_LIMIT);
  return { ok: true, run: w.run, newClues: w.newClues };
}

/** 守在该房间入口、尚未通过的守卫。 */
export function mysteryGuardAt(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  roomId: string,
) {
  return caseFile.guards?.find(
    (g) => g.roomId === roomId && !run.passedGuards?.includes(g.id),
  );
}

/**
 * 进入房间：每次都写全貌，回来时不再只给一句，免得前后浓淡割裂。描写是开局时写定的，
 * 之后用 `state` 条目补上此地局面的变化，免得叙事与局面矛盾，前端单独标出、不被略过：
 * 守卫已退、去路已开或被封、机关已开或锁死随时都补；查看过的物件、取走的物品、
 * 用过物品的地方、被毁的物件与离场的人物只在玩家先前来过时补，没见过的不提。
 */
function enterRoom(w: RunWriter, target: MysteryCaseFile['rooms'][number]) {
  const { caseFile, run } = w;
  run.location = target.id;
  const first = !run.visited.includes(target.id);
  if (first) run.visited.push(target.id);
  w.log({
    kind: 'scene',
    text: target.description,
    ...(first ? {} : { revisit: true as const }),
  });
  const note = (text: string) => w.log({ kind: 'state', text });
  const here = caseFile.objects.filter((o) => o.roomId === target.id);
  const objectName = (id: string) =>
    caseFile.objects.find((o) => o.id === id)?.name ?? id;

  for (const guard of caseFile.guards ?? [])
    if (guard.roomId === target.id && run.passedGuards?.includes(guard.id))
      note(`${guard.name}已不再拦路。`);
  for (const room of mysteryNeighbors(caseFile, target.id)) {
    if (run.sealedRooms?.includes(room.id))
      note(`通往${room.name}的路已被异变封住。`);
    else if (room.requires && evaluateMysteryCondition(room.requires, run))
      note(`通往${room.name}的路已经打开。`);
  }
  for (const mechanism of caseFile.mechanisms ?? []) {
    const state = run.mechanisms?.[mechanism.id];
    if (mechanism.final || !here.some((o) => o.id === mechanism.objectId))
      continue;
    if (state?.solved) note(`${mechanism.name}已经开启。`);
    else if (state?.locked) note(`${mechanism.name}已经锁死，再也动不了。`);
  }
  if (first) return;

  // 每件物件只说一次：毁去、取走、动过优先于“查看过”。
  const mentioned = new Set<string>();
  for (const object of here)
    if (run.destroyed?.includes(object.id)) {
      mentioned.add(object.id);
      note(`${object.name}已被毁去，只剩残迹。`);
    }
  for (const item of caseFile.items)
    if (
      item.foundAt &&
      here.some((o) => o.id === item.foundAt!.objectId) &&
      run.firedInteractions.includes(`found:${item.id}`)
    ) {
      mentioned.add(item.foundAt.objectId);
      note(`${item.name}已从${objectName(item.foundAt.objectId)}取走。`);
    }
  for (const interaction of caseFile.interactions)
    if (
      run.firedInteractions.includes(interaction.id) &&
      here.some((o) => o.id === interaction.targetId)
    ) {
      const item = caseFile.items.find((i) => i.id === interaction.itemId);
      mentioned.add(interaction.targetId);
      note(
        `${objectName(interaction.targetId)}已用${item?.name ?? '物品'}动过。`,
      );
    }
  const searched = here.filter(
    (o) => run.searched.includes(o.id) && !mentioned.has(o.id),
  );
  if (searched.length > 0)
    note(`你已查看过${searched.map((o) => o.name).join('、')}。`);
  for (const npc of caseFile.npcs)
    if (npc.roomId === target.id && run.departed?.includes(npc.id))
      note(`${npc.name}已经离开了这里。`);
}

const REPEAT_HINT = '还是那个念头：';

/** 连点提示时，最近一次提示（其后只有“还是那个念头”的重复提醒）。 */
function lastHint(run: MysteryRunState) {
  for (let i = run.log.length - 1; i >= 0; i--) {
    const entry = run.log[i]!;
    if (entry.kind === 'hint') return entry.text;
    if (entry.kind !== 'system' || !entry.text.startsWith(REPEAT_HINT))
      return null;
  }
  return null;
}

/** 守卫所守房间与当前位置相邻、尚未通过时，返回守卫与房间。 */
function guardAhead(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  guardId: string,
) {
  const guard = caseFile.guards?.find((g) => g.id === guardId);
  if (!guard || run.passedGuards?.includes(guard.id)) return null;
  const room = mysteryNeighbors(caseFile, run.location).find(
    (r) => r.id === guard.roomId,
  );
  return room ? { guard, room } : null;
}

/** 强闯前的校验：守卫就在前方、行动力尚存。成功时返回守卫。 */
export function mysteryGuardChallenge(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  guardId: string,
):
  | { ok: true; guard: NonNullable<MysteryCaseFile['guards']>[number] }
  | { ok: false; error: string } {
  if (run.actionsLeft <= 0)
    return { ok: false, error: '行动力已用完，只能提交推理了' };
  const ahead = guardAhead(caseFile, run, guardId);
  if (!ahead) return { ok: false, error: '前方没有拦路的守卫' };
  if (!evaluateMysteryCondition(ahead.room.requires, run))
    return { ok: false, error: ahead.room.lockedText ?? '去路被阻' };
  return { ok: true, guard: ahead.guard };
}

/** 强闯的遭遇战结束：消耗 1 点行动力；胜则守卫退散并进入房间，败则留在原地。 */
export function applyMysteryGuardBattle(
  caseFile: MysteryCaseFile,
  current: MysteryRunState,
  guardId: string,
  won: boolean,
): MysteryActionResult {
  const ahead = guardAhead(caseFile, current, guardId);
  if (!ahead) return { ok: false, error: '前方没有拦路的守卫' };
  const run = cloneRun(current);
  run.turn += 1;
  spend(run, 1);
  const w = new RunWriter(caseFile, run);
  if (won) {
    run.passedGuards = [...(run.passedGuards ?? []), guardId];
    w.log({ kind: 'system', text: `你击退了${ahead.guard.name}。` });
    enterRoom(w, ahead.room);
  } else {
    w.log({
      kind: 'system',
      text: `你没能闯过${ahead.guard.name}，只得退了回来。`,
    });
  }
  return finishTurn(w);
}

class RunWriter {
  readonly newClues: string[] = [];
  constructor(
    readonly caseFile: MysteryCaseFile,
    readonly run: MysteryRunState,
  ) {}

  log(entry: Omit<MysteryLogEntry, 'turn'>) {
    this.run.log.push({ turn: this.run.turn, ...entry });
  }

  revealClue(clueId: string) {
    if (this.run.clues.includes(clueId)) return;
    const clue = this.caseFile.clues.find((c) => c.id === clueId);
    if (!clue) return;
    this.run.clues.push(clueId);
    this.newClues.push(clueId);
    this.log({ kind: 'clue', text: `${clue.name}：${clue.text}` });
  }

  grantItem(itemId: string) {
    if (this.run.items.includes(itemId)) return;
    const item = this.caseFile.items.find((i) => i.id === itemId);
    if (!item) return;
    this.run.items.push(itemId);
    this.log({ kind: 'item', text: `${item.name}：${item.text}` });
  }

  apply(effects: readonly MysteryEffect[]) {
    for (const effect of effects) {
      switch (effect.kind) {
        case 'reveal_clue':
          this.revealClue(effect.clueId);
          break;
        case 'grant_item':
          this.grantItem(effect.itemId);
          break;
        case 'consume_item':
          this.run.items = this.run.items.filter((id) => id !== effect.itemId);
          break;
        case 'set_flag':
          if (!this.run.flags.includes(effect.flag))
            this.run.flags.push(effect.flag);
          break;
      }
    }
  }
}

function spend(run: MysteryRunState, amount: number) {
  run.actionsLeft = Math.max(0, run.actionsLeft - amount);
}

/** 执行一个调查动作。只改变运行态，不涉及任何真实资源。 */
export function applyMysteryAction(
  caseFile: MysteryCaseFile,
  current: MysteryRunState,
  action: MysteryAction,
): MysteryActionResult {
  if (current.actionsLeft <= 0) {
    return { ok: false, error: '行动力已用完，只能提交推理了' };
  }
  if (action.type === 'reflect') {
    // 连点提示而局面未变：给出的是同一句，不扣行动力、不推进回合。
    const hint = mysteryHint(caseFile, current);
    if (lastHint(current) === hint) {
      const run = cloneRun(current);
      run.log.push({
        turn: run.turn,
        kind: 'system',
        text: `${REPEAT_HINT}${hint}`,
      });
      run.log = run.log.slice(-LOG_LIMIT);
      return { ok: true, run, newClues: [] };
    }
  }
  const run = cloneRun(current);
  run.turn += 1;
  const w = new RunWriter(caseFile, run);

  switch (action.type) {
    case 'move': {
      const target = mysteryNeighbors(caseFile, run.location).find(
        (r) => r.id === action.roomId,
      );
      if (!target) return { ok: false, error: '此处无法直接前往该地点' };
      if (!evaluateMysteryCondition(target.requires, run)) {
        return {
          ok: false,
          error: target.lockedText ?? '去路被阻，暂时无法通过',
        };
      }
      if (run.sealedRooms?.includes(target.id))
        return { ok: false, error: `${target.name}已被异变封住` };
      const guard = mysteryGuardAt(caseFile, run, target.id);
      if (guard)
        return {
          ok: false,
          error: `${guard.name}拦住了去路：可以应战，或找到化解的办法`,
        };
      spend(run, 1);
      enterRoom(w, target);
      break;
    }
    case 'reflect': {
      // 静思：花 1 点行动力换一句方向性提示，提示只看此刻的局面。
      spend(run, 1);
      w.log({ kind: 'hint', text: mysteryHint(caseFile, current) });
      break;
    }
    case 'operate': {
      const mechanism = caseFile.mechanisms?.find(
        (m) => m.id === action.mechanismId && !m.final,
      );
      const object = caseFile.objects.find((o) => o.id === mechanism?.objectId);
      if (
        !mechanism ||
        !object ||
        object.roomId !== run.location ||
        run.destroyed?.includes(object.id)
      )
        return { ok: false, error: '此处没有这处机关' };
      const state = mysteryMechanismState(run, mechanism.id);
      if (state.solved) return { ok: false, error: '这处机关已经开启' };
      if (state.locked) return { ok: false, error: '这处机关已经锁死' };
      const partIds = mechanism.parts.map((p) => p.id);
      if (
        new Set(action.sequence).size !== 3 ||
        !action.sequence.every((id) => partIds.includes(id))
      )
        return { ok: false, error: '须从部件中依次选出三个' };
      const correct = action.sequence.every(
        (id, i) => mechanism.solution[i] === id,
      );
      if (correct) {
        spend(run, 1);
        run.mechanisms = {
          ...run.mechanisms,
          [mechanism.id]: { ...state, solved: true },
        };
        if (!run.flags.includes(`${mechanism.id}_solved`))
          run.flags.push(`${mechanism.id}_solved`);
        w.log({ kind: 'detail', text: mechanism.solvedText });
        w.apply(mechanism.onSolve);
        // 小机关全部一次开启、从未触发反噬时记下分支标记。
        const all = (caseFile.mechanisms ?? []).filter((m) => !m.final);
        if (
          all.every((m) => mysteryMechanismState(run, m.id).solved) &&
          all.every((m) => mysteryMechanismState(run, m.id).failures === 0) &&
          !run.flags.includes('trial_clean')
        )
          run.flags.push('trial_clean');
      } else {
        // 反噬：多扣 1 点行动力，错满即锁死。
        spend(run, 2);
        const failures = state.failures + 1;
        const locked = failures >= MECHANISM_MAX_FAILURES;
        run.mechanisms = {
          ...run.mechanisms,
          [mechanism.id]: { ...state, failures, locked },
        };
        w.log({ kind: 'detail', text: mechanism.backlashText });
        if (locked)
          w.log({ kind: 'system', text: `${mechanism.name}彻底锁死了。` });
      }
      break;
    }
    case 'bypass_guard': {
      const ahead = guardAhead(caseFile, run, action.guardId);
      if (!ahead) return { ok: false, error: '前方没有拦路的守卫' };
      if (!evaluateMysteryCondition(ahead.room.requires, run))
        return { ok: false, error: ahead.room.lockedText ?? '去路被阻' };
      if (!evaluateMysteryCondition(ahead.guard.bypass, run))
        return { ok: false, error: '你还没有化解它的办法' };
      spend(run, 1);
      run.passedGuards = [...(run.passedGuards ?? []), ahead.guard.id];
      w.log({ kind: 'detail', text: ahead.guard.bypassText });
      enterRoom(w, ahead.room);
      break;
    }
    case 'search': {
      const object = caseFile.objects.find(
        (o) => o.id === action.objectId && o.roomId === run.location,
      );
      if (!object) return { ok: false, error: '此处没有这件东西' };
      if (run.destroyed?.includes(object.id))
        return { ok: false, error: '它已经被毁去了' };
      const before = run.clues.length + run.items.length;
      if (!run.searched.includes(object.id)) {
        spend(run, 1);
        run.searched.push(object.id);
      }
      w.log({ kind: 'detail', text: object.detail });
      for (const clue of caseFile.clues) {
        if (
          clue.foundAt?.objectId === object.id &&
          evaluateMysteryCondition(clue.foundAt.requires, run)
        )
          w.revealClue(clue.id);
      }
      for (const item of caseFile.items) {
        if (
          item.foundAt?.objectId === object.id &&
          !run.firedInteractions.includes(`found:${item.id}`) &&
          evaluateMysteryCondition(item.foundAt.requires, run)
        ) {
          run.firedInteractions.push(`found:${item.id}`);
          w.grantItem(item.id);
        }
      }
      if (
        run.clues.length + run.items.length === before &&
        current.searched.includes(object.id)
      ) {
        w.log({ kind: 'system', text: '再看一遍，并无新的发现。' });
      }
      break;
    }
    case 'use': {
      if (!run.items.includes(action.itemId))
        return { ok: false, error: '你身上没有这件东西' };
      const targetHere =
        caseFile.objects.some(
          (o) =>
            o.id === action.targetId &&
            o.roomId === run.location &&
            !run.destroyed?.includes(o.id),
        ) || Boolean(mysteryNpcPresent(caseFile, run, action.targetId));
      if (!targetHere) return { ok: false, error: '目标不在此处' };
      spend(run, 1);
      const interaction = caseFile.interactions.find(
        (i) =>
          i.itemId === action.itemId &&
          i.targetId === action.targetId &&
          !run.firedInteractions.includes(i.id) &&
          evaluateMysteryCondition(i.requires, run),
      );
      if (!interaction) {
        w.log({ kind: 'system', text: '试了试，毫无反应。' });
        break;
      }
      run.firedInteractions.push(interaction.id);
      w.log({ kind: 'detail', text: interaction.text });
      w.apply(interaction.effects);
      break;
    }
    case 'talk': {
      const npc = mysteryNpcPresent(caseFile, run, action.npcId);
      if (!npc) return { ok: false, error: '此人不在这里' };
      spend(run, 1);
      const first = !run.talkedTo.includes(npc.id);
      if (first) run.talkedTo.push(npc.id);
      const secrets = npc.secrets.filter(
        (s) =>
          !run.clues.includes(s.clueId) &&
          evaluateMysteryCondition(s.requires, run),
      );
      if (first || secrets.length === 0) {
        w.log({
          kind: 'speech',
          speaker: npc.name,
          text: first ? npc.greeting : npc.idleLine,
        });
      }
      for (const secret of secrets) {
        w.log({ kind: 'speech', speaker: npc.name, text: secret.line });
        w.revealClue(secret.clueId);
      }
      break;
    }
    case 'present': {
      const npc = mysteryNpcPresent(caseFile, run, action.npcId);
      if (!npc) return { ok: false, error: '此人不在这里' };
      if (
        !run.clues.includes(action.evidenceId) &&
        !run.items.includes(action.evidenceId)
      )
        return { ok: false, error: '你并未掌握这件证据' };
      spend(run, 1);
      if (!run.talkedTo.includes(npc.id)) run.talkedTo.push(npc.id);
      const reaction = npc.reactions.find(
        (r) =>
          r.evidenceId === action.evidenceId &&
          !run.firedReactions.includes(r.id),
      );
      if (!reaction) {
        w.log({ kind: 'speech', speaker: npc.name, text: npc.deflectLine });
        break;
      }
      run.firedReactions.push(reaction.id);
      w.log({ kind: 'speech', speaker: npc.name, text: reaction.line });
      w.apply(reaction.effects);
      break;
    }
  }

  return finishTurn(w);
}

const DIALOGUE_MEMORY = 4;

/** 此刻该人物可以透露的秘密：解锁条件已满足、且玩家尚未掌握对应线索。 */
export function mysteryRevealableSecrets(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
  npcId: string,
) {
  const npc = caseFile.npcs.find((n) => n.id === npcId);
  return (npc?.secrets ?? []).filter(
    (s) =>
      !run.clues.includes(s.clueId) &&
      evaluateMysteryCondition(s.requires, run),
  );
}

/**
 * 自由对话：问题与回复由服务端生成，这里只做在场校验、扣行动力与越权过滤。
 * 模型声称透露的线索只保留当前确实可以透露的那些，话术无法套出未解锁的线索。
 */
export function applyMysteryDialogue(
  caseFile: MysteryCaseFile,
  current: MysteryRunState,
  turn: {
    npcId: string;
    question: string;
    reply: string;
    reveal: readonly string[];
  },
): MysteryActionResult {
  if (current.actionsLeft <= 0) {
    return { ok: false, error: '行动力已用完，只能提交推理了' };
  }
  const npc = mysteryNpcPresent(caseFile, current, turn.npcId);
  if (!npc) return { ok: false, error: '此人不在这里' };
  const allowed = new Set(
    mysteryRevealableSecrets(caseFile, current, npc.id).map((s) => s.clueId),
  );
  const run = cloneRun(current);
  run.turn += 1;
  spend(run, 1);
  if (!run.talkedTo.includes(npc.id)) run.talkedTo.push(npc.id);
  const w = new RunWriter(caseFile, run);
  w.log({ kind: 'speech', speaker: '你', text: turn.question });
  w.log({ kind: 'speech', speaker: npc.name, text: turn.reply });
  for (const clueId of turn.reveal)
    if (allowed.has(clueId)) w.revealClue(clueId);
  run.dialogue = {
    ...current.dialogue,
    [npc.id]: [
      ...(current.dialogue?.[npc.id] ?? []),
      { q: turn.question, a: turn.reply },
    ].slice(-DIALOGUE_MEMORY),
  };
  return finishTurn(w);
}
