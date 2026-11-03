import { SeededRng } from '@daoyou/combat-core/rng';
import type {
  MysteryCaseFile,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import { eventTurns, type MysteryCaseSkeleton } from './skeleton.js';

const T = '…';

/** allegiance 原型约定的身份槽位与结案问题。 */
const ALLEGIANCE_SLOTS = ['envoy_a', 'envoy_b', 'broker'] as const;
const ALLEGIANCE_QUESTIONS = ['intent_a', 'intent_b', 'side'] as const;

function assertAllegianceTemplate(template: MysteryScenarioTemplate) {
  for (const slot of ALLEGIANCE_SLOTS)
    if (!template.roles.some((r) => r.slot === slot))
      throw new Error(`allegiance 模板缺少身份 ${slot}`);
  const ids = template.questions.map((q) => q.id).sort();
  if (ids.join() !== [...ALLEGIANCE_QUESTIONS].sort().join())
    throw new Error('allegiance 模板的结案问题必须为 intent_a、intent_b、side');
  for (const q of template.questions)
    if (q.answer_kind !== 'choice')
      throw new Error(`allegiance 模板的 ${q.id} 问题必须为选择题`);
  if (!template.questions.find((q) => q.id === 'side')?.judgement)
    throw new Error('allegiance 模板的 side 问题必须是抉择题');
}

/**
 * 生成立场抉择骨架：两方各有公开说法与真实图谋（一方另有私心但不害无辜，另一方所图祸及无辜，
 * 由种子决定哪方是哪种），各在一件事上说谎；中间人两头挑拨，可被密信揭穿。
 * 结案先判两方图谋，再自行抉择站哪一边。
 */
export function buildAllegianceSkeleton(
  template: MysteryScenarioTemplate,
  seed: number,
): MysteryCaseSkeleton {
  assertAllegianceTemplate(template);
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

  const harmful = rng.chance(0.5) ? 'a' : 'b';
  const nature = (side: 'a' | 'b') =>
    side === harmful
      ? '所图会祸及无辜（为私利不惜牺牲旁人）'
      : '另有私心但不害无辜（所图不光彩，却不伤旁人）';
  const bystanderRole = template.roles.find((r) => r.slot === 'bystander');
  const withBystander =
    Boolean(bystanderRole && bystanderRole.count[1] > 0) &&
    template.scale.npcs[1] >= 4 &&
    rng.chance(0.6);
  const roll = rng.next();
  const guardCount = roll < 0.3 ? 0 : roll < 0.8 ? 1 : 2;

  // 房间：入口、两方都能到的中立地、甲方营地、乙方营地、一两处偏处，可能有守卫把守的静室。
  const entrance = 'room_entrance';
  const hub = 'room_hub';
  const campA = 'room_camp_a';
  const campB = 'room_camp_b';
  const sides = Array.from(
    { length: int(1, Math.min(2, template.scale.rooms[1] - 4 - guardCount)) },
    (_, i) => `room_side_${i + 1}`,
  );
  const exits = new Map<string, string[]>([
    [entrance, [hub]],
    [hub, []],
  ]);
  const attached = [hub];
  for (const room of shuffle([campA, campB, ...sides])) {
    exits.get(pick(attached))!.push(room);
    exits.set(room, []);
    attached.push(room);
  }
  const openRooms = attached;
  const guarded = Array.from(
    { length: guardCount },
    (_, i) => `room_guarded_${i + 1}`,
  );
  for (const room of guarded) {
    exits.get(pick(openRooms))!.push(room);
    exits.set(room, []);
  }

  const purposes: Record<string, string> = {
    [entrance]: '入口：交代此地两方对峙的气氛',
    [hub]: '中立地：两方都会经过的地方，消息在这里流传',
    [campA]: '甲方的营地或据点',
    [campB]: '乙方的营地或据点',
    ...Object.fromEntries(sides.map((r) => [r, '偏处：此地的其他地方'])),
    ...Object.fromEntries(
      guarded.map((r) => [r, '守卫把守的静室：藏着旁证，不进也能判断']),
    ),
  };

  const envoyA = 'npc_envoy_a';
  const envoyB = 'npc_envoy_b';
  const broker = 'npc_broker';
  const bystander = 'npc_bystander';
  const brokerRoom = pick([hub, ...sides]);

  const objects: MysteryCaseFile['objects'] = [];
  const object = (id: string, roomId: string, purpose: string) => {
    objects.push({ id, roomId, name: T, detail: T });
    purposes[id] = purpose;
  };
  // 营外的痕迹、记载与密信只放在中立处，不放进另一方的营地。
  const neutral = [hub, ...sides];
  const elsewhere = (exclude: string[]) =>
    pick(neutral.filter((r) => !exclude.includes(r)));
  object(
    'obj_plan_a',
    campA,
    '甲方营地里能看出其真实图谋的东西（文书、器物、布置）',
  );
  object(
    'obj_plan_b',
    campB,
    '乙方营地里能看出其真实图谋的东西（文书、器物、布置）',
  );
  object('obj_trace_a', elsewhere([campA]), '甲方在营地之外留下的行事痕迹');
  object('obj_trace_b', elsewhere([campB]), '乙方在营地之外留下的行事痕迹');
  object(
    'obj_record_a',
    elsewhere([campA]),
    '记载往事的地方，有一条与甲方代表所称相悖的事实',
  );
  object(
    'obj_record_b',
    elsewhere([campB]),
    '记载往事的地方，有一条与乙方代表所称相悖的事实',
  );
  object(
    'obj_letter',
    elsewhere([brokerRoom]),
    '中间人藏起的往来密信，可见其两头挑拨',
  );
  guarded.forEach((room, i) =>
    object(
      `obj_cache_${i + 1}`,
      room,
      i === 0 ? '旁证甲方图谋的东西' : '旁证乙方图谋的东西',
    ),
  );
  for (const [room] of exits)
    if (!objects.some((o) => o.roomId === room))
      object(`obj_${room.replace('room_', '')}`, room, '此处的陈设，可供细看');

  const items: MysteryCaseFile['items'] = [];
  if (guardCount >= 1) {
    items.push({
      id: 'item_pass',
      name: T,
      text: T,
      foundAt: { objectId: 'obj_record_a' },
    });
    purposes.item_pass = '一件信物或令符，能让第一个守卫认出来意、让路';
  }

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
    'clue_plan_a',
    true,
    ['intent_a'],
    `甲方营地中的实据，显出甲方的真实图谋（${nature('a')}）`,
    'obj_plan_a',
  );
  clue(
    'clue_plan_b',
    true,
    ['intent_b'],
    `乙方营地中的实据，显出乙方的真实图谋（${nature('b')}）`,
    'obj_plan_b',
  );
  clue(
    'clue_trace_a',
    true,
    ['intent_a'],
    '甲方在外留下的行事痕迹，印证其图谋',
    'obj_trace_a',
  );
  clue(
    'clue_trace_b',
    true,
    ['intent_b'],
    '乙方在外留下的行事痕迹，印证其图谋',
    'obj_trace_b',
  );
  clue(
    'clue_record_a',
    true,
    ['intent_a'],
    '记载中与甲方代表所称矛盾的事实，可当面戳穿',
    'obj_record_a',
  );
  clue(
    'clue_record_b',
    true,
    ['intent_b'],
    '记载中与乙方代表所称矛盾的事实，可当面戳穿',
    'obj_record_b',
  );
  clue('clue_letter', true, [], '中间人两头传话、暗中挑拨的密信', 'obj_letter');
  if (withBystander)
    clue(
      'clue_witness',
      true,
      [harmful === 'a' ? 'intent_a' : 'intent_b'],
      '旁人亲眼见过的事，指出所图会祸及无辜的那一方做过什么',
    );
  guarded.forEach((_, i) =>
    clue(
      `clue_cache_${i + 1}`,
      true,
      i === 0 ? ['intent_a'] : ['intent_b'],
      i === 0 ? '旁证甲方图谋的东西' : '旁证乙方图谋的东西',
      `obj_cache_${i + 1}`,
    ),
  );
  clue('clue_claim_a', false, [], '甲方代表的公开说法中的一句谎言');
  clue('clue_claim_b', false, [], '乙方代表的公开说法中的一句谎言');
  clue('clue_claim', false, [], '中间人关于自己来意或立场的说法（是谎言）');

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
  const envoy = (side: 'a' | 'b', room: string) =>
    npc(
      side === 'a' ? envoyA : envoyB,
      side === 'a' ? 'envoy_a' : 'envoy_b',
      room,
      `${side === 'a' ? '甲' : '乙'}方的出面人，想拉你入伙；真实图谋：${nature(side)}；在一件事上说谎`,
      {
        secrets: [
          {
            clueId: `clue_claim_${side}`,
            requires: { visited: hub },
            line: T,
          },
        ],
        reactions: [
          {
            id: `react_envoy_${side}`,
            evidenceId: `clue_record_${side}`,
            line: T,
            effects: [{ kind: 'set_flag', flag: `envoy_${side}_exposed` }],
            exposesLie: true,
          },
        ],
      },
    );
  const npcs: MysteryCaseFile['npcs'] = [
    envoy('a', campA),
    envoy('b', campB),
    npc(
      broker,
      'broker',
      brokerRoom,
      '两头传话、暗中挑拨的中间人，想坐收渔利',
      {
        secrets: [
          { clueId: 'clue_claim', requires: { visited: hub }, line: T },
        ],
        reactions: [
          {
            id: 'react_broker_letter',
            evidenceId: 'clue_letter',
            line: T,
            effects: [{ kind: 'set_flag', flag: 'broker_exposed' }],
            exposesLie: true,
          },
        ],
      },
    ),
  ];
  if (withBystander)
    npcs.push(
      npc(
        bystander,
        'bystander',
        pick([hub, ...sides]),
        '被卷进来的旁人，知道双方各一部分实情',
        {
          secrets: [
            {
              clueId: 'clue_witness',
              requires: { any: [{ visited: campA }, { visited: campB }] },
              line: T,
            },
          ],
          reactions: [],
        },
      ),
    );
  purposes[`${envoyA}:clue_claim_a`] =
    '玩家到过中立地后再问，甲方代表说出公开说法里的谎言';
  purposes[`${envoyB}:clue_claim_b`] =
    '玩家到过中立地后再问，乙方代表说出公开说法里的谎言';
  purposes[`${broker}:clue_claim`] =
    '玩家到过中立地后再问，中间人说出关于自己立场的谎言';
  if (withBystander)
    purposes[`${bystander}:clue_witness`] =
      '玩家到过任一方营地后再问，旁人说出亲眼所见';
  purposes.react_envoy_a = '被记载当面戳穿时的慌乱与辩解';
  purposes.react_envoy_b = '被记载当面戳穿时的慌乱与辩解';
  purposes.react_broker_letter = '被出示密信后撕下伪装，或狡辩或求饶';

  const guards: NonNullable<MysteryCaseFile['guards']> = guarded.map(
    (room, i) => {
      const id = `guard_${i + 1}`;
      purposes[id] =
        i === 0
          ? '某一方布下的守卫（傀儡、护卫或驯兽）；持信物可令其让路'
          : '某一方布下的守卫；揭穿中间人后得知的口令可令其退下';
      return {
        id,
        roomId: room,
        name: T,
        description: T,
        bypass:
          i === 0 ? { has_item: 'item_pass' } : { flag: 'broker_exposed' },
        bypassText: T,
      };
    },
  );

  const options = (entries: ReadonlyArray<readonly [string, string]>) =>
    shuffle(entries).map(([id, purpose]) => {
      purposes[`option:${id}`] = purpose;
      return { id, label: T };
    });
  const intentOptions = (side: 'a' | 'b') =>
    options([
      [`intent_${side}_true`, `真实图谋（${nature(side)}）`],
      [`intent_${side}_claim`, '干扰项：此方的公开说法'],
      [`intent_${side}_slander`, '干扰项：对方与中间人对此方的指控'],
      [`intent_${side}_other`, '干扰项：另一种看似合理的猜测'],
    ]);

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
    interactions: [],
    questions: [
      {
        id: 'intent_a',
        options: intentOptions('a'),
        answer: 'intent_a_true',
        explanation: T,
      },
      {
        id: 'intent_b',
        options: intentOptions('b'),
        answer: 'intent_b_true',
        explanation: T,
      },
      {
        id: 'side',
        options: options([
          ['side_a', '支持甲方'],
          ['side_b', '支持乙方'],
          ['side_mediate', '两不相帮，出面调停'],
        ]),
        // 抉择题没有标准答案，此处只为满足结构。
        answer: 'side_mediate',
        explanation: T,
      },
    ],
    ...(guards.length ? { guards } : {}),
    // 中间人察觉风声，要烧掉密信；先拿到密信或揭穿他即可阻止。
    events: [
      {
        id: 'evt_burn',
        ...eventTurns(template, 0.45, 0.55),
        unless: {
          any: [{ has_clue: 'clue_letter' }, { flag: 'broker_exposed' }],
        },
        warning: T,
        text: T,
        effects: [{ kind: 'destroy_object', objectId: 'obj_letter' }],
      },
    ],
  };
  purposes.evt_burn =
    '中间人察觉风声，去烧掉藏起的密信；预兆是他神色不宁、频频离开，发生时写你事后闻到焦味、密信已毁';
  purposes['explanation:side'] =
    '不评对错、不预设答案：用势力名称（不写“甲方”“乙方”）分别写三种抉择各自会带来什么，开头不要先下结论';
  return { caseFile, purposes };
}
