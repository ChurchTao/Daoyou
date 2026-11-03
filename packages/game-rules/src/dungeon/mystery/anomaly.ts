import { SeededRng } from '@daoyou/combat-core/rng';
import type {
  MysteryCaseFile,
  MysteryRunState,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import { eventTurns, type MysteryCaseSkeleton } from './skeleton.js';

const T = '…';

/** anomaly 原型约定的身份槽位与结案问题。 */
const ANOMALY_SLOTS = ['culprit', 'local', 'scapegoat'] as const;
const ANOMALY_QUESTIONS = ['source', 'culprit', 'remedy'] as const;

function assertAnomalyTemplate(template: MysteryScenarioTemplate) {
  for (const slot of ANOMALY_SLOTS)
    if (!template.roles.some((r) => r.slot === slot))
      throw new Error(`anomaly 模板缺少身份 ${slot}`);
  const ids = template.questions.map((q) => q.id).sort();
  if (ids.join() !== [...ANOMALY_QUESTIONS].sort().join())
    throw new Error('anomaly 模板的结案问题必须为 source、culprit、remedy');
  for (const id of ['source', 'remedy'])
    if (template.questions.find((q) => q.id === id)?.answer_kind !== 'choice')
      throw new Error(`anomaly 模板的 ${id} 问题必须为选择题`);
}

const SOURCE_OPTIONS = [
  ['source_true', '真正的异变之源，与症状分布和源头痕迹相符'],
  ['source_local', '干扰项：当地人以为的源头'],
  ['source_scapegoat', '干扰项：背锅者身上的表象所指之处'],
  ['source_other', '干扰项：另一处看似合理的地方'],
] as const;

const REMEDY_OPTIONS = [
  ['remedy_true', '真正的平息之法，与古法与源头铭刻相符'],
  ['remedy_force', '干扰项：以蛮力强行镇压'],
  ['remedy_folk', '干扰项：当地流传的土法'],
  ['remedy_other', '干扰项：另一种看似合理、但与古法不符的办法'],
] as const;

/**
 * 生成异变溯源骨架：症状越近源头越重，源头处留有祸首的物证与平息古法的铭刻；
 * 异变分三重随回合加剧，封住偏殿或毁去源头物证，只伤加分内容；
 * 找到镇物用在源头可暂时镇住。随种子变化的有：房间连通、人物站位、有无知情者、守卫个数。
 */
const STAGE_PREFIX = 'evt_stage_';
const CONTAINED_FLAG = 'anomaly_contained';

/** 异变加剧的进度：按骨架约定的分重事件与镇住标记计算；不是异变案卷时返回 null。 */
export function mysteryAnomalyStatus(
  caseFile: MysteryCaseFile,
  run: MysteryRunState,
) {
  const stages = (caseFile.events ?? []).filter((e) =>
    e.id.startsWith(STAGE_PREFIX),
  );
  if (stages.length === 0) return null;
  return {
    stage: stages.filter((e) => run.events?.includes(e.id)).length,
    stages: stages.length,
    contained: run.flags.includes(CONTAINED_FLAG),
  };
}

export function buildAnomalySkeleton(
  template: MysteryScenarioTemplate,
  seed: number,
): MysteryCaseSkeleton {
  assertAnomalyTemplate(template);
  const rng = new SeededRng(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(rng.next() * (max - min + 1));
  const pick = <V>(values: readonly V[]): V =>
    values[Math.floor(rng.next() * values.length)]!;
  const shuffle = <V>(values: readonly V[]): V[] => {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  const sageRole = template.roles.find((r) => r.slot === 'sage');
  const withSage =
    Boolean(sageRole && sageRole.count[1] > 0) &&
    template.scale.npcs[1] >= 4 &&
    rng.chance(0.5);
  const roll = rng.next();
  const guardCount = roll < 0.25 ? 0 : roll < 0.75 ? 1 : 2;

  // 房间：入口、受害最显处（当地人在此）、源头、两到三处偏殿，可能有守卫把守的静室。
  const entrance = 'room_entrance';
  const hub = 'room_hub';
  const source = 'room_source';
  // 两处会被加剧封住的偏殿只作末端房间挂在主干上，封了不会切断通往其他地方的路。
  const sides = Array.from(
    { length: int(2, Math.min(3, template.scale.rooms[1] - 3 - guardCount)) },
    (_, i) => `room_side_${i + 1}`,
  );
  const [farSide, loreSide] = [sides[0]!, sides[1]!];
  const exits = new Map<string, string[]>([
    [entrance, [hub]],
    [hub, []],
  ]);
  const core = [hub];
  for (const room of shuffle([source, ...sides.slice(2)])) {
    exits.get(pick(core))!.push(room);
    exits.set(room, []);
    core.push(room);
  }
  for (const room of [farSide, loreSide]) {
    exits.get(pick(core))!.push(room);
    exits.set(room, []);
  }
  const openRooms = [...core, farSide, loreSide];
  const guarded = Array.from(
    { length: guardCount },
    (_, i) => `room_guarded_${i + 1}`,
  );
  for (const room of guarded) {
    exits.get(pick(core))!.push(room);
    exits.set(room, []);
  }

  const purposes: Record<string, string> = {
    [entrance]: '入口：交代此地的样子与异变初现的迹象',
    [hub]: '受害最显处：当地人聚在这里，异变的后果看得最清楚',
    [source]: '异变之源所在：越往这里症状越重，源头本身此刻还看不出全貌',
    ...Object.fromEntries(sides.map((r) => [r, '偏殿：此地的其他房间'])),
    ...Object.fromEntries(
      guarded.map((r) => [r, '守卫把守的静室：藏着旁证，不进也能解谜']),
    ),
  };

  const culprit = 'npc_culprit';
  const local = 'npc_local';
  const scapegoat = 'npc_scapegoat';
  const sage = 'npc_sage';
  const culpritRoom = pick(openRooms.filter((r) => r !== source));
  const scapegoatRoom = pick(
    openRooms.filter((r) => r !== culpritRoom && r !== source),
  );
  const sageRoom = pick(sides);

  const objects: MysteryCaseFile['objects'] = [];
  const object = (id: string, roomId: string, purpose: string) => {
    objects.push({ id, roomId, name: T, detail: T });
    purposes[id] = purpose;
  };
  object(
    'obj_symptom_near',
    hub,
    '异变症状最重的地方（枯死的灵草、发狂的妖兽留下的痕迹、开裂的阵纹）',
  );
  object(
    'obj_symptom_far',
    farSide,
    '偏殿里较轻的症状，与受害最显处一比，能看出异变朝哪个方向加重',
  );
  object(
    'obj_source',
    source,
    '异变之源：此刻只见异象，细看能找到源头处的痕迹',
  );
  object(
    'obj_evidence',
    source,
    '源头旁祸首留下的东西（器物、记号、截脉的钉子等）',
  );
  object('obj_carving', source, '源头处前人刻下的平息古法残文');
  object(
    'obj_record',
    pick(
      openRooms.filter(
        (r) => r !== culpritRoom && r !== farSide && r !== loreSide,
      ),
    ),
    '记载往事或出入的地方，有一条与祸首所称相悖的事实',
  );
  object(
    'obj_suspect',
    pick([scapegoatRoom, hub]),
    '指向背锅者的可疑痕迹：确有其事，但另有清白的缘由',
  );
  object(
    'obj_ward_spot',
    pick(
      openRooms.filter((r) => r !== source && r !== farSide && r !== loreSide),
    ),
    '放着一件能暂时镇住异变的镇物的地方',
  );
  if (!withSage)
    object('obj_lore', loreSide, '记载平息古法关键一环的典籍或碑文');
  guarded.forEach((room, i) =>
    object(
      `obj_cache_${i + 1}`,
      room,
      i === 0 ? '旁证异变源头的东西' : '旁证平息之法的东西',
    ),
  );
  for (const [room] of exits)
    if (!objects.some((o) => o.roomId === room))
      object(`obj_${room.replace('room_', '')}`, room, '此处的陈设，可供细看');

  const items: MysteryCaseFile['items'] = [
    {
      id: 'item_ward',
      name: T,
      text: T,
      foundAt: { objectId: 'obj_ward_spot' },
    },
  ];
  purposes.item_ward = '镇物：用在源头可暂时镇住异变；也能让第一个守卫安静让路';

  const clues: MysteryCaseFile['clues'] = [];
  const clue = (
    id: string,
    key: boolean,
    supports: string[],
    purpose: string,
    foundAt?: string,
  ) => {
    clues.push({
      id,
      name: T,
      text: T,
      key,
      supports,
      ...(foundAt ? { foundAt: { objectId: foundAt } } : {}),
    });
    purposes[id] = purpose;
  };
  clue(
    'clue_symptom_near',
    true,
    ['source'],
    '受害最显处的症状，具体可查',
    'obj_symptom_near',
  );
  clue(
    'clue_symptom_far',
    true,
    ['source'],
    '偏殿的症状较轻，两相对照指出异变加重的方向',
    'obj_symptom_far',
  );
  clue(
    'clue_source',
    true,
    ['source'],
    '源头处的痕迹，证明异变由此而起',
    'obj_source',
  );
  clue(
    'clue_evidence',
    true,
    ['culprit'],
    '源头旁祸首留下的物证，能落到祸首身上',
    'obj_evidence',
  );
  clue(
    'clue_record',
    true,
    ['culprit'],
    '记载中的事实，与祸首所称的行踪或所为矛盾，可当面戳穿',
    'obj_record',
  );
  clue(
    'clue_alibi',
    true,
    ['culprit'],
    '背锅者被出示可疑痕迹后拿出的凭据，证明与异变无关',
  );
  clue(
    'clue_carving',
    true,
    ['remedy'],
    '源头处前人刻下的平息古法残文，缺了关键一环',
    'obj_carving',
  );
  clue(
    'clue_lore',
    true,
    ['remedy'],
    withSage
      ? '知情者读过源头残文后才肯说的关键一环'
      : '典籍或碑文中记载的平息古法关键一环',
    withSage ? undefined : 'obj_lore',
  );
  guarded.forEach((_, i) =>
    clue(
      `clue_cache_${i + 1}`,
      true,
      i === 0 ? ['source'] : ['remedy'],
      i === 0 ? '旁证异变源头的东西' : '旁证平息之法的东西',
      `obj_cache_${i + 1}`,
    ),
  );
  clue(
    'clue_suspect',
    false,
    [],
    '指向背锅者的可疑痕迹：确有其事，但另有清白的缘由',
    'obj_suspect',
  );
  clue('clue_claim', false, [], '祸首关于自己行踪或所为的说法（是谎言）');
  clue('clue_belief', false, [], '当地人认定的罪魁与源头（是错的）');

  const npc = (
    id: string,
    role: string,
    roomId: string,
    purpose: string,
    rest: Pick<MysteryCaseFile['npcs'][number], 'secrets' | 'reactions'>,
  ): MysteryCaseFile['npcs'][number] => {
    purposes[id] = purpose;
    return {
      id,
      name: T,
      title: T,
      role,
      roomId,
      greeting: T,
      idleLine: T,
      deflectLine: T,
      ...rest,
    };
  };
  const npcs: MysteryCaseFile['npcs'] = [
    npc(
      culprit,
      'culprit',
      culpritRoom,
      '引发异变的祸首（有意或无心），在行踪或所为上说谎',
      {
        secrets: [
          { clueId: 'clue_claim', requires: { visited: hub }, line: T },
        ],
        reactions: [
          {
            id: 'react_culprit_record',
            evidenceId: 'clue_record',
            line: T,
            effects: [{ kind: 'set_flag', flag: 'culprit_exposed' }],
            exposesLie: true,
          },
        ],
      },
    ),
    npc(
      local,
      'local',
      hub,
      '受异变所害的当地人，症状说得最清楚，认定的罪魁却是错的',
      {
        secrets: [
          { clueId: 'clue_belief', requires: { visited: hub }, line: T },
        ],
        reactions: [],
      },
    ),
    npc(
      scapegoat,
      'scapegoat',
      scapegoatRoom,
      '被当地人怪罪的外来者，有可疑之处但与异变无关',
      {
        secrets: [],
        reactions: [
          {
            id: 'react_scapegoat_cleared',
            evidenceId: 'clue_suspect',
            line: T,
            effects: [
              { kind: 'reveal_clue', clueId: 'clue_alibi' },
              { kind: 'set_flag', flag: 'scapegoat_cleared' },
            ],
            exposesLie: false,
          },
        ],
      },
    ),
  ];
  if (withSage)
    npcs.push(
      npc(sage, 'sage', sageRoom, '懂得古法的老人、残魂或典籍守护者', {
        secrets: [
          {
            clueId: 'clue_lore',
            requires: { has_clue: 'clue_carving' },
            line: T,
          },
        ],
        reactions: [],
      }),
    );
  purposes[`${culprit}:clue_claim`] =
    '玩家到过受害最显处后再问，祸首说出关于自己行踪或所为的谎言';
  purposes[`${local}:clue_belief`] = '当地人说出他认定的罪魁与源头';
  if (withSage)
    purposes[`${sage}:clue_lore`] =
      '玩家读过源头残文后再问，知情者道出平息古法的关键一环';
  purposes.react_culprit_record = '被记载当面戳穿时的慌乱与狡辩';
  purposes.react_scapegoat_cleared =
    '被出示可疑痕迹后又急又恼，说出清白的缘由并拿出凭据';
  purposes.use_ward_source = '把镇物用在源头上，异变暂时被压住';
  purposes.manifest =
    '异变之源化成的形体（如枯藤妖、地脉煞灵），结案答对后扑出与你交手';

  const guards: NonNullable<MysteryCaseFile['guards']> = guarded.map(
    (room, i) => {
      const id = `guard_${i + 1}`;
      purposes[id] =
        i === 0
          ? '被异变惊扰的妖兽或失控的傀儡，守在静室门口；镇物可令其安静让路'
          : '被异变惊扰的妖兽或失控的傀儡；背锅者洗清嫌疑后告诉你的法子可令其退下';
      return {
        id,
        roomId: room,
        name: T,
        description: T,
        bypass:
          i === 0 ? { has_item: 'item_ward' } : { flag: 'scapegoat_cleared' },
        bypassText: T,
      };
    },
  );

  const options = (entries: ReadonlyArray<readonly [string, string]>) =>
    shuffle(entries).map(([id, purpose]) => {
      purposes[`option:${id}`] = purpose;
      return { id, label: T };
    });
  const contained = { flag: CONTAINED_FLAG };

  const caseFile: MysteryCaseFile = {
    templateId: template.id,
    title: T,
    truth: T,
    brief: {
      identity: T,
      goal: T,
      opening: T,
      relations: npcs.map((n) => ({ npcId: n.id, text: T })),
    },
    startRoomId: entrance,
    rooms: [...exits].map(([id, roomExits]) => ({
      id,
      name: T,
      description: T,
      brief: T,
      exits: roomExits,
    })),
    objects,
    clues,
    items,
    npcs,
    interactions: [
      {
        id: 'use_ward_source',
        itemId: 'item_ward',
        targetId: 'obj_source',
        text: T,
        effects: [{ kind: 'set_flag', flag: 'anomaly_contained' }],
      },
    ],
    questions: [
      {
        id: 'source',
        options: options(SOURCE_OPTIONS),
        answer: 'source_true',
        explanation: T,
      },
      { id: 'culprit', answer: culprit, explanation: T },
      {
        id: 'remedy',
        options: options(REMEDY_OPTIONS),
        answer: 'remedy_true',
        explanation: T,
      },
    ],
    manifest: { name: T, description: T },
    ...(guards.length ? { guards } : {}),
    // 异变分三重加剧：封偏殿、毁源头物证、再封一处偏殿；镇住后不再加剧。
    events: [
      {
        id: 'evt_stage_1',
        ...eventTurns(template, 0.25, 0.3),
        unless: contained,
        warning: T,
        text: T,
        effects: [{ kind: 'seal_room', roomId: farSide }],
      },
      {
        id: 'evt_stage_2',
        ...eventTurns(template, 0.5, 0.55),
        unless: contained,
        warning: T,
        text: T,
        effects: [{ kind: 'destroy_object', objectId: 'obj_evidence' }],
      },
      {
        id: 'evt_stage_3',
        ...eventTurns(template, 0.75, 0.8),
        unless: contained,
        warning: T,
        text: T,
        effects: [{ kind: 'seal_room', roomId: loreSide }],
      },
    ],
  };
  purposes.evt_stage_1 =
    '异变第一重加剧：预兆是症状蔓延，发生时写一处偏殿被异象封住、进不去了';
  purposes.evt_stage_2 =
    '异变第二重加剧：预兆是源头异象翻涌，发生时写源头旁的东西被异象吞没、毁去';
  purposes.evt_stage_3 =
    '异变第三重加剧：预兆是整个地方都在震动，发生时写又一处偏殿被封住';
  return { caseFile, purposes };
}
