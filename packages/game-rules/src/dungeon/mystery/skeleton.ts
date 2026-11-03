import { SeededRng } from '@daoyou/combat-core/rng';
import type {
  MysteryCaseFile,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import { buildAllegianceSkeleton } from './allegiance.js';
import { buildAnomalySkeleton } from './anomaly.js';
import { buildRetrievalSkeleton } from './retrieval.js';
import { buildUnlockSkeleton } from './unlock.js';

/** 文本占位符；骨架里所有面向玩家的文字都由 LLM 之后填写。 */
export const MYSTERY_TEXT_PLACEHOLDER = '…';

/**
 * 案卷骨架：结构（房间图、线索获取链、锁与钥匙、谎言与戳穿、嫌疑人与反证、答案）
 * 由程序确定，保证可解；`purposes` 告诉 LLM 每个元素在谜题中承担什么作用。
 * secret 的键为 `${npcId}:${clueId}`，手段选项的键为 `option:${optionId}`。
 */
export interface MysteryCaseSkeleton {
  caseFile: MysteryCaseFile;
  purposes: Record<string, string>;
  /** 由程序渲染说法的选择题选项：选项 id → 主禁制部件次序。 */
  sequences?: Record<string, string[]>;
}

const T = MYSTERY_TEXT_PLACEHOLDER;

/**
 * 按模板权重为种子抽取结构变体。用独立的随机序列，
 * 同一种子在 base 下得到的骨架与引入变体之前完全相同。
 */
export function pickMysteryVariant(
  template: MysteryScenarioTemplate,
  seed: number,
): string {
  const variants = template.variants ?? [{ id: 'base', weight: 1 }];
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  let roll = new SeededRng(seed ^ 0x5bd1e995).next() * total;
  for (const v of variants) {
    roll -= v.weight;
    if (roll < 0) return v.id;
  }
  return variants[variants.length - 1]!.id;
}

/** 事件的预兆与发生回合：按行动力预算的比例换算。 */
export function eventTurns(
  template: MysteryScenarioTemplate,
  warn: number,
  at: number,
) {
  const budget = template.scale.action_budget;
  return {
    warnAt: Math.max(1, Math.round(budget * warn)),
    at: Math.max(2, Math.round(budget * at)),
  };
}

/** 按模板原型分派骨架构造器；同一模板与种子总是得到同一骨架。 */
export function buildMysterySkeleton(
  template: MysteryScenarioTemplate,
  seed: number,
): MysteryCaseSkeleton {
  switch (template.archetype) {
    case 'whodunit':
      return buildWhodunitSkeleton(template, seed);
    case 'retrieval':
      return buildRetrievalSkeleton(template, seed);
    case 'unlock':
      return buildUnlockSkeleton(template, seed);
    case 'anomaly':
      return buildAnomalySkeleton(template, seed);
    case 'allegiance':
      return buildAllegianceSkeleton(template, seed);
    default:
      throw new Error(`暂不支持原型 ${template.archetype} 的骨架生成`);
  }
}

/** whodunit 原型约定的身份槽位与结案问题。 */
const WHODUNIT_SLOTS = ['culprit', 'heir', 'suspect'] as const;
const WHODUNIT_QUESTIONS = ['who', 'how', 'heir'] as const;

function assertWhodunitTemplate(template: MysteryScenarioTemplate) {
  if (template.archetype !== 'whodunit')
    throw new Error(`暂不支持原型 ${template.archetype} 的骨架生成`);
  for (const slot of WHODUNIT_SLOTS)
    if (!template.roles.some((r) => r.slot === slot))
      throw new Error(`whodunit 模板缺少身份 ${slot}`);
  const ids = template.questions.map((q) => q.id).sort();
  if (ids.join() !== [...WHODUNIT_QUESTIONS].sort().join())
    throw new Error('whodunit 模板的结案问题必须为 who、how、heir');
  if (template.questions.find((q) => q.id === 'how')?.answer_kind !== 'choice')
    throw new Error('whodunit 模板的手段问题必须为选择题');
}

/** 手段选项：真相一项，另有指向嫌疑人、传闻与常见误判的干扰项。 */
const METHOD_OPTIONS = [
  ['method_true', '真正的作案手段，与 clue_method 揭示的事实一致'],
  ['method_suspect', '干扰项：顺着嫌疑人的可疑物证会得出的手段'],
  ['method_rumor', '干扰项：传闻或表象所示的死因（如走火入魔、寿尽坐化）'],
  ['method_other', '干扰项：另一种看似合理、但与物证不符的手段'],
] as const;

/**
 * 生成 whodunit 骨架。同一模板与种子总是得到同一骨架；随种子变化的有：
 * 房间数与连通、物证与人物的位置、有无封闭密室、作案手段由谁揭示
 * （工具探查、旁人目击或取得信任后的传人）、凶手在哪方面说谎、有无旁人。
 * 每局都有一名被冤枉的嫌疑人：留有可疑物证，被当面出示后给出反证。
 */
function buildWhodunitSkeleton(
  template: MysteryScenarioTemplate,
  seed: number,
): MysteryCaseSkeleton {
  assertWhodunitTemplate(template);
  const rng = new SeededRng(seed);
  const int = (min: number, max: number) =>
    min + Math.floor(rng.next() * (max - min + 1));
  const pick = <V>(values: readonly V[]): V =>
    values[Math.floor(rng.next() * values.length)]!;

  const witnessRole = template.roles.find((r) => r.slot === 'witness');
  const roomCount = int(
    Math.max(4, template.scale.rooms[0]),
    Math.max(4, Math.min(6, template.scale.rooms[1])),
  );
  const withWitness =
    Boolean(witnessRole && witnessRole.count[1] > 0) &&
    template.scale.npcs[1] >= 4 &&
    rng.chance(0.5);
  const withSealed = rng.chance(0.6);
  const methodVia = pick(
    withWitness
      ? (['tool', 'witness', 'heir'] as const)
      : (['tool', 'heir'] as const),
  );
  const pickedLie = pick(['identity', 'whereabouts'] as const);
  // decoy_liar：说谎的是嫌疑人（为掩盖与命案无关的私事谎称行踪），真凶不说谎。
  const variant = pickMysteryVariant(template, seed);
  const decoy = variant === 'decoy_liar';
  const lieAbout = decoy ? 'whereabouts' : pickedLie;
  const liarLabel = decoy ? '嫌疑人' : '凶手';

  // 房间：入口、中枢（死者所在）、作案处、若干旁室，可能有封闭密室（叶子，需钥匙）。
  const entrance = 'room_entrance';
  const hub = 'room_hub';
  const crime = 'room_crime';
  const sealed = 'room_sealed';
  const extras = Array.from(
    { length: roomCount - (withSealed ? 4 : 3) },
    (_, i) => `room_side_${i + 1}`,
  );
  const exits = new Map<string, string[]>([
    [entrance, [hub]],
    [hub, [crime]],
    [crime, []],
  ]);
  const attached = [hub, crime];
  for (const room of extras) {
    exits.get(pick(attached))!.push(room);
    exits.set(room, []);
    attached.push(room);
  }
  const sealedParent = pick(attached);
  if (withSealed) {
    exits.get(sealedParent)!.push(sealed);
    exits.set(sealed, []);
  }
  const openRooms = attached; // 不含入口与密室

  const purposes: Record<string, string> = {
    [entrance]: '入口：玩家进场的地方，交代此地的样子',
    [hub]: '中枢：洞府主人遗骸所在之处',
    [crime]: '作案处：凶手当年动手的地方，留有作案器物',
    ...(withSealed
      ? { [sealed]: '封闭密室：凶手当年用钥匙锁上、在此藏了罪证；进门只需钥匙' }
      : {}),
    ...Object.fromEntries(extras.map((r) => [r, '旁室：洞府中的其他房间'])),
  };

  // 人物站位。
  const culprit = 'npc_culprit';
  const heir = 'npc_heir';
  const suspect = 'npc_suspect';
  const witness = 'npc_witness';
  const culpritRoom = pick(openRooms);
  const heirRoom = sealedParent;
  const suspectRoom = pick(openRooms.filter((r) => r !== culpritRoom));
  const witnessRoom = pick([entrance, ...(extras.length ? extras : [crime])]);

  // 物件与物品位置。
  const objects: MysteryCaseFile['objects'] = [];
  const object = (id: string, roomId: string, purpose: string) => {
    objects.push({ id, roomId, name: T, detail: T });
    purposes[id] = purpose;
  };
  object('obj_entrance', entrance, '入口处的痕迹，与案情无关，可作误导');
  object('obj_remains', hub, '洞府主人的遗骸，留有临死前的痕迹');
  object(
    'obj_method',
    crime,
    methodVia === 'tool'
      ? '凶手作案用到的器物，表面看不出异样，需要工具探查'
      : '凶手作案用到的器物，细看只觉异样，真相要靠知情人道出',
  );
  if (methodVia === 'tool')
    object(
      'obj_tools',
      pick([crime, ...extras]),
      '放着杂物的地方，可以找到一件探查用的工具',
    );
  object(
    'obj_record',
    pick(openRooms.filter((r) => r !== hub)),
    lieAbout === 'identity'
      ? `存放记录的地方，记载着与${liarLabel}所称身份相悖的事实`
      : `存放记录的地方，记载着与${liarLabel}所称行踪相悖的事实`,
  );
  object(
    'obj_seal',
    withSealed ? sealedParent : pick(openRooms),
    withSealed
      ? '封闭密室的门，刻着洞府主人一脉的纹样（只是印记，不是机关）'
      : '刻着洞府主人一脉纹样的石碑或牌匾（只是印记）',
  );
  object(
    'obj_hidden',
    withSealed ? sealed : pick(openRooms.filter((r) => r !== culpritRoom)),
    withSealed ? '凶手藏在密室里的东西' : '凶手藏匿罪证的隐蔽角落',
  );
  object(
    'obj_suspect',
    pick([suspectRoom, crime]),
    '留有指向嫌疑人的可疑痕迹之处',
  );
  const keyAtRemains = rng.chance(0.5);
  if (withSealed && !keyAtRemains)
    object(
      'obj_keyspot',
      pick(openRooms.filter((r) => r !== sealedParent)),
      '一处不起眼的地方，藏着开启密室的钥匙',
    );
  // 误导线索：入口痕迹、凶手的谎言、嫌疑人的可疑物证，再加旁人传闻或一件可疑物件。
  if (!withWitness)
    object(
      'obj_herring',
      extras.length ? pick(extras) : crime,
      '看似可疑、实则与案情无关的东西',
    );
  for (const [room] of exits) {
    if (!objects.some((o) => o.roomId === room))
      object(`obj_${room.replace('room_', '')}`, room, '此处的陈设，可供细看');
  }

  const items: MysteryCaseFile['items'] = [];
  if (withSealed) {
    items.push({
      id: 'item_key',
      name: T,
      text: T,
      foundAt: { objectId: keyAtRemains ? 'obj_remains' : 'obj_keyspot' },
    });
    purposes.item_key = '凶手当年锁密室用的钥匙，后来遗落在洞府里';
  }
  if (methodVia === 'tool') {
    items.push({
      id: 'item_tool',
      name: T,
      text: T,
      foundAt: { objectId: 'obj_tools' },
    });
    purposes.item_tool = '能探查作案器物的工具';
  }

  // 线索：7 条关键线索覆盖三个结案问题；误导线索 4 条。
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
    'clue_body',
    true,
    ['who'],
    '遗骸上的残缺痕迹，凶手与嫌疑人都对得上，单凭它分不出是谁',
    'obj_remains',
  );
  clue(
    'clue_method',
    true,
    ['how'],
    methodVia === 'tool'
      ? '作案手段的直接证据，用工具探查作案器物后才发现'
      : methodVia === 'witness'
        ? '旁人亲眼所见的作案经过，指明了作案手段'
        : '传人取得信任后道出的家族所知，指明了作案手段',
  );
  clue(
    'clue_record',
    !decoy,
    decoy ? [] : ['who'],
    lieAbout === 'identity'
      ? `记录中的事实，与${liarLabel}所称的身份矛盾，可当面戳穿`
      : `记录中的事实，与${liarLabel}所称的行踪矛盾，可当面戳穿`,
    'obj_record',
  );
  if (decoy)
    clue(
      'clue_confess',
      true,
      ['who'],
      '嫌疑人被戳穿后坦白的私事，以及那晚为此躲在暗处时撞见的一幕：指向真凶',
    );
  clue(
    'clue_hidden',
    true,
    ['who'],
    '凶手藏匿的罪证，能把痕迹落实到凶手而不是嫌疑人身上',
    'obj_hidden',
  );
  clue(
    'clue_seal',
    true,
    ['heir'],
    withSealed
      ? '密室门上洞府主人一脉的纹样，与传人的信物同源（开门靠钥匙，不靠信物）'
      : '洞府主人一脉的纹样，与传人的信物同源',
    'obj_seal',
  );
  clue(
    'clue_token',
    true,
    ['heir'],
    '传人出示的祖传信物，纹样与门上相同，证明其血脉',
  );
  clue(
    'clue_alibi',
    true,
    ['who'],
    '嫌疑人被出示可疑物证后给出的辩白与可核实的凭据，洗清其嫌疑',
  );
  // decoy_liar 里嫌疑人的谎言与被戳穿的记录已是误导，入口痕迹不再出线索。
  if (!decoy)
    clue(
      'clue_entrance',
      false,
      [],
      '入口处的误导痕迹，有合理的其他解释',
      'obj_entrance',
    );
  clue(
    'clue_claim',
    false,
    [],
    decoy
      ? '嫌疑人关于自己案发时行踪的说法（是谎言，为掩盖一件与命案无关、见不得人的私事）'
      : lieAbout === 'identity'
        ? '凶手关于自己身份来历的说法（是谎言）'
        : '凶手关于自己案发时行踪的说法（是谎言）',
  );
  clue(
    'clue_suspect',
    false,
    [],
    '指向嫌疑人的可疑物证：确有其事，但另有清白的缘由',
    'obj_suspect',
  );
  if (withWitness)
    clue('clue_rumor', false, [], '旁人听来的传闻，只说对了一半');
  else
    clue(
      'clue_herring',
      false,
      [],
      '一件看似可疑、其实另有缘由的东西',
      'obj_herring',
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
    decoy
      ? npc(
          culprit,
          'culprit',
          culpritRoom,
          '真凶，以伪装身份出现但所言不虚，只对案发当晚的事避而不谈；乐于把嫌疑引向嫌疑人',
          {
            secrets: [],
            reactions: [
              {
                id: 'react_culprit_seen',
                evidenceId: 'clue_confess',
                line: T,
                effects: [{ kind: 'set_flag', flag: 'culprit_exposed' }],
                exposesLie: false,
              },
            ],
          },
        )
      : npc(
          culprit,
          'culprit',
          culpritRoom,
          '真凶，以伪装身份出现，有求于玩家，乐于把嫌疑引向嫌疑人',
          {
            secrets: [
              { clueId: 'clue_claim', requires: { visited: crime }, line: T },
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
    npc(heir, 'heir', heirRoom, '真正的传人，起初戒备；不知道钥匙在哪', {
      secrets:
        methodVia === 'heir'
          ? [
              {
                clueId: 'clue_method',
                requires: { flag: 'heir_trusted' },
                line: T,
              },
            ]
          : [],
      reactions: [
        {
          id: 'react_heir_seal',
          evidenceId: 'clue_seal',
          line: T,
          effects: [
            { kind: 'reveal_clue', clueId: 'clue_token' },
            { kind: 'set_flag', flag: 'heir_trusted' },
          ],
          exposesLie: false,
        },
      ],
    }),
    npc(
      suspect,
      'suspect',
      suspectRoom,
      decoy
        ? '被冤枉的嫌疑人，与命案无关，却为掩盖一件见不得人的私事谎称了案发时的行踪；被戳穿后坦白，并说出那晚撞见的一幕'
        : '被冤枉的嫌疑人，有动机也有可疑之处，性情不讨喜，但与命案无关',
      {
        secrets: decoy
          ? [{ clueId: 'clue_claim', requires: { visited: crime }, line: T }]
          : [],
        reactions: [
          {
            id: 'react_suspect_cleared',
            evidenceId: 'clue_suspect',
            line: T,
            effects: [
              { kind: 'reveal_clue', clueId: 'clue_alibi' },
              { kind: 'set_flag', flag: 'suspect_cleared' },
            ],
            exposesLie: false,
          },
          ...(decoy
            ? [
                {
                  id: 'react_suspect_record',
                  evidenceId: 'clue_record',
                  line: T,
                  effects: [
                    { kind: 'reveal_clue' as const, clueId: 'clue_confess' },
                    { kind: 'set_flag' as const, flag: 'suspect_confessed' },
                  ],
                  exposesLie: true,
                },
              ]
            : []),
        ],
      },
    ),
  ];
  if (decoy) {
    purposes[`${suspect}:clue_claim`] =
      '玩家到过作案处后再问，嫌疑人说出关于自己案发时行踪的谎言';
    purposes.react_suspect_record =
      '被记录当面戳穿谎言后，坦白那晚真正去做的私事，并说出当时撞见的一幕';
    purposes.react_culprit_seen = '被出示嫌疑人撞见的那一幕时神色骤变';
  } else {
    purposes[`${culprit}:clue_claim`] =
      lieAbout === 'identity'
        ? '玩家到过作案处后再问，凶手说出关于自己身份来历的谎言'
        : '玩家到过作案处后再问，凶手说出关于自己案发时行踪的谎言';
    purposes.react_culprit_record = '被记录当面戳穿谎言时的慌乱';
  }
  purposes.react_heir_seal = '被出示纹样后，拿出纹样相同的祖传信物、放下戒备';
  purposes.react_suspect_cleared =
    '被出示可疑物证后又急又恼，说出清白的缘由并拿出凭据';
  if (methodVia === 'heir')
    purposes[`${heir}:clue_method`] =
      '取得信任后再问，传人说出家族所知的作案手段';
  if (withWitness) {
    npcs.push(
      npc(witness, 'witness', witnessRoom, '旁人，知道一部分事实但看不清全貌', {
        secrets: [
          { clueId: 'clue_rumor', requires: { visited: hub }, line: T },
          ...(methodVia === 'witness'
            ? [{ clueId: 'clue_method', requires: { visited: crime }, line: T }]
            : []),
        ],
        reactions: [],
      }),
    );
    purposes[`${witness}:clue_rumor`] =
      '玩家见过遗骸后再问，旁人说出听来的传闻';
    if (methodVia === 'witness')
      purposes[`${witness}:clue_method`] =
        '玩家到过作案处后再问，旁人说出亲眼所见的作案经过';
  }

  // 手段选项顺序随种子打乱（Fisher–Yates），答案位置不固定。
  const shuffled: Array<(typeof METHOD_OPTIONS)[number]> = [...METHOD_OPTIONS];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = int(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const options = shuffled.map(([id, purpose]) => {
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
      ...(id === sealed
        ? { requires: { has_item: 'item_key' }, lockedText: T }
        : {}),
    })),
    objects,
    clues,
    items,
    npcs,
    interactions:
      methodVia === 'tool'
        ? [
            {
              id: 'use_tool_method',
              itemId: 'item_tool',
              targetId: 'obj_method',
              text: T,
              effects: [{ kind: 'reveal_clue', clueId: 'clue_method' }],
            },
          ]
        : [],
    questions: [
      { id: 'who', answer: culprit, explanation: T },
      { id: 'how', options, answer: 'method_true', explanation: T },
      { id: 'heir', answer: heir, explanation: T },
    ],
    // 行动过半时凶手去毁掉藏起的罪证；玩家先拿到罪证或当面戳穿凶手即可阻止。
    events: [
      {
        id: 'evt_destroy',
        ...eventTurns(template, 0.4, 0.5),
        unless: {
          any: [{ has_clue: 'clue_hidden' }, { flag: 'culprit_exposed' }],
        },
        warning: T,
        text: T,
        effects: [{ kind: 'destroy_object', objectId: 'obj_hidden' }],
      },
    ],
  };
  purposes.evt_destroy =
    '凶手察觉调查逼近，趁你不备去毁掉藏起的罪证；预兆是凶手的异常举动，发生时只写你事后察觉藏罪证之处被人动过、东西已毁，不写罪证的具体内容';
  if (methodVia === 'tool')
    purposes.use_tool_method = '用工具探查作案器物，发现作案手段';
  return { caseFile, purposes };
}
