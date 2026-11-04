import { SeededRng } from '@daoyou/combat-core/rng';
import type {
  MysteryCaseFile,
  MysteryHintRule,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  mechanismCandidates,
  mechanismSequences,
  pickHintRules,
} from './mechanism.js';
import {
  eventTurns,
  pickMysteryVariant,
  type MysteryCaseSkeleton,
} from './skeleton.js';

const T = '…';

/** unlock 原型约定的身份槽位与结案问题。 */
const UNLOCK_SLOTS = ['warden', 'rival', 'fallen'] as const;
const UNLOCK_QUESTIONS = ['order', 'catalyst', 'cause'] as const;

function assertUnlockTemplate(template: MysteryScenarioTemplate) {
  for (const slot of UNLOCK_SLOTS)
    if (!template.roles.some((r) => r.slot === slot))
      throw new Error(`unlock 模板缺少身份 ${slot}`);
  const ids = template.questions.map((q) => q.id).sort();
  if (ids.join() !== [...UNLOCK_QUESTIONS].sort().join())
    throw new Error('unlock 模板的结案问题必须为 order、catalyst、cause');
  for (const q of template.questions)
    if (q.answer_kind !== 'choice')
      throw new Error(`unlock 模板的 ${q.id} 问题必须为选择题`);
}

const CATALYST_OPTIONS = [
  ['catalyst_true', '真正的引子，与守试者的谜语和前人遗物相符'],
  ['catalyst_rival', '干扰项：闯关者声称的引子'],
  ['catalyst_rumor', '干扰项：传闻中的引子'],
  ['catalyst_other', '干扰项：另一种看似合理、但与谜语不符的引子'],
] as const;

const CAUSE_OPTIONS = [
  ['cause_true', '真相：前人是被闯关者给的假解法误导，才触发反噬'],
  ['cause_self', '干扰项：前人自述的原因（以为是自己记错了一步）'],
  ['cause_rumor', '干扰项：传闻所说的原因（触怒了守试者）'],
  ['cause_other', '干扰项：另一种看似合理的原因'],
] as const;

/** honest_rival：闯关者给的解法本是对的，前人自己记错了一步。 */
const CAUSE_OPTIONS_HONEST = [
  ['cause_true', '真相：前人记错了一步次序，闯关者给他的解法本是对的'],
  ['cause_misled', '干扰项：被闯关者的假解法误导（闯关者其实没有骗他）'],
  ['cause_rumor', '干扰项：传闻所说的原因（触怒了守试者）'],
  ['cause_other', '干扰项：另一种看似合理的原因'],
] as const;

/**
 * 生成破禁试炼骨架：两个小机关（各 4 部件、选 3 个按序开启，两条提示唯一确定解法），
 * 开启后各得一句主禁制残句；主禁制在结案时作答，由铭文与两句残句三条规则唯一确定。
 * 随种子变化的有：房间连通、物件与人物站位、两个机关与主禁制的解法、提示规则、守卫个数。
 */
export function buildUnlockSkeleton(
  template: MysteryScenarioTemplate,
  seed: number,
): MysteryCaseSkeleton {
  assertUnlockTemplate(template);
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
  const random = () => rng.next();
  // honest_rival：闯关者所言属实，误导来自前人记错的一步。
  const variant = pickMysteryVariant(template, seed);
  const honest = variant === 'honest_rival';

  const roll = rng.next();
  const guardCount = roll < 0.25 ? 0 : roll < 0.75 ? 1 : 2;
  const sides = int(1, Math.max(1, template.scale.rooms[1] - 4 - guardCount));

  // 房间：入口、主殿（主禁制与守试者）、两处试炼室（各一机关）、偏殿，可能有守卫把守的静室。
  const entrance = 'room_entrance';
  const hub = 'room_hub';
  const trials = ['room_trial_1', 'room_trial_2'];
  const extras = Array.from({ length: sides }, (_, i) => `room_side_${i + 1}`);
  const exits = new Map<string, string[]>([
    [entrance, [hub]],
    [hub, []],
  ]);
  const attached = [hub];
  for (const room of shuffle([...trials, ...extras])) {
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
    [entrance]: '入口：试炼禁地的门户，交代此地的样子',
    [hub]: '主殿：主禁制所在，守试者守在这里',
    room_trial_1: '第一处试炼室：设有一处机关',
    room_trial_2: '第二处试炼室：设有一处机关',
    ...Object.fromEntries(extras.map((r) => [r, '偏殿：禁地中的其他房间'])),
    ...Object.fromEntries(
      guarded.map((r) => [
        r,
        '守卫把守的静室：藏着前辈留下的旁证，不进也能解谜',
      ]),
    ),
  };

  const warden = 'npc_warden';
  const rival = 'npc_rival';
  const fallen = 'npc_fallen';
  const rivalRoom = pick(openRooms.filter((r) => r !== hub));
  const fallenRoom = pick(openRooms.filter((r) => r !== rivalRoom));

  const objects: MysteryCaseFile['objects'] = [];
  const object = (id: string, roomId: string, purpose: string) => {
    objects.push({ id, roomId, name: T, detail: T });
    purposes[id] = purpose;
  };
  const elsewhere = (room: string) =>
    pick(openRooms.filter((r) => r !== room && r !== hub));

  object(
    'obj_seal_main',
    hub,
    '主禁制：刻着铭文的石门或阵盘，在结案时开启，此刻不能操作',
  );
  object('obj_mech_1', 'room_trial_1', '第一处机关：四个可按动的部件');
  object('obj_mech_2', 'room_trial_2', '第二处机关：四个可按动的部件');
  object(
    'obj_inscr_1',
    elsewhere('room_trial_1'),
    '刻着第一处机关提示的地方（壁刻、残碑、手记等）',
  );
  object(
    'obj_inscr_2',
    elsewhere('room_trial_2'),
    '刻着第二处机关提示的地方（壁刻、残碑、手记等）',
  );
  object('obj_relic', fallenRoom, '前人留下的遗物，暗示开启主禁制所需的引子');
  object(
    'obj_record',
    pick(openRooms.filter((r) => r !== rivalRoom)),
    '记载往事的地方，有一条与闯关者所称相悖的事实',
  );
  object(
    'obj_trace',
    'room_trial_2',
    '机关旁不久前被人动过的痕迹（新的刮痕、错位的部件）',
  );
  guarded.forEach((room, i) =>
    object(
      `obj_cache_${i + 1}`,
      room,
      i === 0
        ? '前辈留下的手札，旁证主禁制的引子'
        : '前人的随身遗物，旁证他失败的真正原因',
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
      foundAt: { objectId: 'obj_record' },
    });
    purposes.item_pass = '前辈留下的令牌或符，能让第一个守卫认出来意、让路';
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

  // 小机关：解法随种子，提示固定两条（找不到两条的解法换一组重抽）。
  const mechanism = (n: 1 | 2) => {
    const parts = [1, 2, 3, 4].map((k) => `m${n}_p${k}`);
    let solution: string[];
    let rules: MysteryHintRule[];
    do {
      solution = pick(mechanismSequences(parts));
      rules = pickHintRules(parts, solution, random);
    } while (rules.length !== 2);
    const hintIds = [`clue_m${n}_h1`, `clue_m${n}_h2`];
    clue(
      hintIds[0]!,
      true,
      [],
      `第${n}处机关的一条提示：只写提示出现在何处、什么样子，提示原话由程序补上`,
      `obj_inscr_${n}`,
    );
    clue(
      hintIds[1]!,
      true,
      [],
      `第${n}处机关的另一条真实提示：由人物凭亲眼所见回忆或以谜语道出（不是闯关者告诉的），只写说话的神态，原话由程序补上`,
    );
    clue(
      `clue_frag_${n}`,
      true,
      ['order'],
      `第${n}处机关开启后显现的一句关于主禁制开启次序的残句（与引子无关）：只写残句在何处显现、什么样子，原话由程序补上`,
    );
    parts.forEach((p) => (purposes[p] = `第${n}处机关的部件`));
    return {
      id: `mech_${n}`,
      objectId: `obj_mech_${n}`,
      name: T,
      final: false,
      parts: parts.map((id) => ({ id, label: T })),
      solution,
      hints: rules.map((rule, i) => ({ clueId: hintIds[i]!, rule })),
      onSolve: [{ kind: 'reveal_clue' as const, clueId: `clue_frag_${n}` }],
      solvedText: T,
      backlashText: T,
    };
  };
  const mech1 = mechanism(1);
  const mech2 = mechanism(2);
  purposes.mech_1 = '第一处机关';
  purposes.mech_2 = '第二处机关';

  // 主禁制：三条规则（铭文、两句残句），合起来唯一确定；铭文一条单独不足以确定。
  const sealParts = [1, 2, 3, 4].map((k) => `s_p${k}`);
  let sealSolution: string[];
  let sealRules: MysteryHintRule[];
  do {
    sealSolution = pick(mechanismSequences(sealParts));
    sealRules = pickHintRules(sealParts, sealSolution, random);
  } while (sealRules.length > 3);
  if (sealRules.length === 2) {
    const extra = [
      ...sealSolution.map((part, index) => ({
        kind: 'position' as const,
        part,
        index,
      })),
    ].find(
      (r) => !sealRules.some((x) => JSON.stringify(x) === JSON.stringify(r)),
    )!;
    sealRules = [...sealRules, extra];
  }
  sealParts.forEach((p) => (purposes[p] = '主禁制的部件'));
  clue(
    'clue_main',
    true,
    ['order'],
    '主禁制上本就刻着的一句铭文，进主殿即可看到，关于开启次序：只写刻在哪里、什么样子，原话由程序补上',
    'obj_seal_main',
  );
  const seal = {
    id: 'seal_main',
    objectId: 'obj_seal_main',
    name: T,
    final: true,
    parts: sealParts.map((id) => ({ id, label: T })),
    solution: sealSolution,
    hints: [
      { clueId: 'clue_main', rule: sealRules[0]! },
      { clueId: 'clue_frag_1', rule: sealRules[1]! },
      { clueId: 'clue_frag_2', rule: sealRules[2]! },
    ],
    onSolve: [],
    solvedText: T,
    backlashText: T,
  };
  purposes.seal_main = '主禁制';

  clue(
    'clue_catalyst',
    true,
    ['catalyst'],
    '守试者读过铭文的人才肯说的谜语，指向开启主禁制所需的引子',
  );
  clue(
    'clue_relic',
    true,
    ['catalyst'],
    '前人遗物上的痕迹，印证引子是什么',
    'obj_relic',
  );
  clue(
    'clue_record',
    true,
    ['cause'],
    honest
      ? '记载中的事实，与前人自述的经过矛盾：当年他按动的次序与他记得的不同，可当面指出'
      : '记载中的事实，与闯关者的说法矛盾，可当面戳穿',
    'obj_record',
  );
  clue(
    'clue_trace',
    true,
    ['cause'],
    honest
      ? '第二处机关旁的旧痕迹，显示当年按动的次序与正确次序只差一步'
      : '第二处机关旁的新痕迹，显示有人在前人之前动过手脚',
    'obj_trace',
  );
  clue(
    'clue_misled',
    true,
    ['cause'],
    honest
      ? '前人被指出记载后醒悟：当年是自己记错了一步，闯关者给的解法没有错'
      : '前人看到痕迹后醒悟：当年那套解法是闯关者给的，他被误导了',
  );
  guarded.forEach((_, i) =>
    clue(
      `clue_cache_${i + 1}`,
      true,
      i === 0 ? ['catalyst'] : ['cause'],
      i === 0
        ? '前辈手札中的旁证，印证引子'
        : '前人遗物中的旁证，印证他失败的真正原因',
      `obj_cache_${i + 1}`,
    ),
  );
  clue(
    'clue_claim',
    false,
    [],
    honest
      ? '闯关者关于当年把解法交给前人的说法（属实，但他拿不出凭据）'
      : '闯关者关于自己来历或与前人关系的说法（是谎言）',
  );
  clue(
    'clue_account',
    false,
    [],
    honest
      ? '前人自述的失败原因：认定是闯关者给了他假解法（并非真相，他记错了一步）'
      : '前人自述的失败原因：以为是自己记错了一步（并非真相）',
  );

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
      warden,
      'warden',
      hub,
      '守试者（器灵、残魂或守塔人），只用谜语回答，结尾亲自出手考校',
      {
        secrets: [
          {
            clueId: 'clue_catalyst',
            requires: { has_clue: 'clue_main' },
            line: T,
          },
          {
            clueId: 'clue_m2_h2',
            requires: { visited: 'room_trial_2' },
            line: T,
          },
        ],
        reactions: [],
      },
    ),
    npc(
      rival,
      'rival',
      rivalRoom,
      honest
        ? '同场的闯关者，当年把解法如实给了前人，却被前人认定是骗子；脾气冲，不屑辩解'
        : '同场的闯关者，声称从前人那里得了解法，实则误导旁人',
      {
        secrets: [
          { clueId: 'clue_claim', requires: { visited: hub }, line: T },
        ],
        reactions: honest
          ? []
          : [
              {
                id: 'react_rival_record',
                evidenceId: 'clue_record',
                line: T,
                effects: [{ kind: 'set_flag', flag: 'rival_exposed' }],
                exposesLie: true,
              },
            ],
      },
    ),
    npc(
      fallen,
      'fallen',
      fallenRoom,
      honest
        ? '曾在此失败的前人（残念或重伤未走的人），记错了一步却认定是闯关者害了他'
        : '曾在此失败的前人（残念或重伤未走的人），记忆有偏差',
      {
        secrets: [
          { clueId: 'clue_account', requires: { visited: hub }, line: T },
          {
            clueId: 'clue_m1_h2',
            requires: { visited: 'room_trial_1' },
            line: T,
          },
        ],
        reactions: [
          honest
            ? {
                id: 'react_fallen_record',
                evidenceId: 'clue_record',
                line: T,
                effects: [
                  { kind: 'reveal_clue', clueId: 'clue_misled' },
                  { kind: 'set_flag', flag: 'fallen_turned' },
                ],
                exposesLie: true,
              }
            : {
                id: 'react_fallen_trace',
                evidenceId: 'clue_trace',
                line: T,
                effects: [
                  { kind: 'reveal_clue', clueId: 'clue_misled' },
                  { kind: 'set_flag', flag: 'fallen_turned' },
                ],
                exposesLie: false,
              },
        ],
      },
    ),
  ];
  purposes[`${warden}:clue_catalyst`] =
    '玩家读过主禁制铭文后再问，守试者以谜语道出引子';
  purposes[`${warden}:clue_m2_h2`] =
    '玩家到过第二处试炼室后再问，守试者以谜语道出一条机关提示';
  purposes[`${rival}:clue_claim`] = honest
    ? '玩家到过主殿后再问，闯关者说起当年把解法交给前人的经过（属实）'
    : '玩家到过主殿后再问，闯关者说出关于自己来历的谎言';
  purposes[`${fallen}:clue_account`] = honest
    ? '玩家到过主殿后再问，前人咬定是闯关者给了他假解法'
    : '玩家到过主殿后再问，前人说出自以为的失败原因';
  purposes[`${fallen}:clue_m1_h2`] =
    '玩家到过第一处试炼室后再问，前人回忆起一条机关提示';
  if (honest)
    purposes.react_fallen_record =
      '被出示记载后愣住，终于想起当年是自己按错了一步，对闯关者的怨气化作愧意';
  else {
    purposes.react_rival_record = '被记载当面戳穿谎言时的慌乱与狡辩';
    purposes.react_fallen_trace =
      '被出示机关旁的新痕迹后醒悟，说出当年那套解法是谁给的';
  }

  const guards: NonNullable<MysteryCaseFile['guards']> = guarded.map(
    (room, i) => {
      const id = `guard_${i + 1}`;
      purposes[id] =
        i === 0
          ? '守在静室门口的傀儡、阵灵或妖兽；持前辈的令牌可令其让路'
          : '守在静室门口的傀儡、阵灵或妖兽；认得前人，前人醒悟后告诉你的口令可令其退下';
      return {
        id,
        roomId: room,
        name: T,
        description: T,
        bypass: i === 0 ? { has_item: 'item_pass' } : { flag: 'fallen_turned' },
        bypassText: T,
      };
    },
  );

  // 次序题的选项由程序按部件名渲染：真次序、只合铭文的两种误判、另一种。
  const decoys = shuffle(
    mechanismCandidates(sealParts, [sealRules[0]!]).filter(
      (s) => s.join() !== sealSolution.join(),
    ),
  );
  const others = shuffle(
    mechanismSequences(sealParts).filter(
      (s) =>
        s.join() !== sealSolution.join() &&
        !decoys.slice(0, 2).some((d) => d.join() === s.join()),
    ),
  );
  const fill = [...decoys, ...others];
  const sequences: Record<string, string[]> = {
    order_true: sealSolution,
    order_rival: fill[0]!,
    order_fallen: fill[1]!,
    order_other:
      others.find(
        (s) => s.join() !== fill[0]!.join() && s.join() !== fill[1]!.join(),
      ) ?? fill[2]!,
  };
  purposes['option:order_true'] = '真正的开启次序';
  purposes['option:order_rival'] = honest
    ? '干扰项：闯关者凭记忆转述的次序（大体对，但差了铭文校正的一步）'
    : '干扰项：闯关者给的次序';
  purposes['option:order_fallen'] = '干扰项：照前人记忆字面得出的次序';
  purposes['option:order_other'] = '干扰项：另一种次序';

  const options = (entries: ReadonlyArray<readonly [string, string]>) =>
    shuffle(entries).map(([id, purpose]) => {
      purposes[`option:${id}`] = purpose;
      return { id, label: T };
    });

  const caseFile: MysteryCaseFile = {
    templateId: template.id,
    ...(variant !== 'base' ? { variant } : {}),
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
        id: 'order',
        options: shuffle(Object.keys(sequences)).map((id) => ({
          id,
          label: T,
        })),
        answer: 'order_true',
        explanation: T,
      },
      {
        id: 'catalyst',
        options: options(CATALYST_OPTIONS),
        answer: 'catalyst_true',
        explanation: T,
      },
      {
        id: 'cause',
        options: options(honest ? CAUSE_OPTIONS_HONEST : CAUSE_OPTIONS),
        answer: 'cause_true',
        explanation: T,
      },
    ],
    mechanisms: [mech1, mech2, seal],
    ...(guards.length ? { guards } : {}),
    // 闯关者抢先乱试，把第二处机关弄锁死；先开启它或先戳穿闯关者即可阻止。
    events: [
      {
        id: 'evt_tamper',
        ...eventTurns(template, 0.45, 0.55),
        unless: {
          any: [
            { flag: 'mech_2_solved' },
            { flag: honest ? 'fallen_turned' : 'rival_exposed' },
          ],
        },
        warning: T,
        text: T,
        effects: [{ kind: 'lock_mechanism', mechanismId: 'mech_2' }],
      },
    ],
  };
  purposes.evt_tamper = honest
    ? '前人心急，照自己记错的次序去试第二处机关；预兆是他频频往那边去、口中念着那套次序，发生时写机关被他弄得锁死'
    : '闯关者按捺不住，抢先去乱试第二处机关；预兆是他频频往那边去，发生时写机关被他弄得锁死';
  return { caseFile, purposes, sequences };
}
