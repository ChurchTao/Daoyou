import { SeededRng } from '@daoyou/combat-core/rng';
import type {
  MysteryCaseFile,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  eventTurns,
  pickMysteryVariant,
  type MysteryCaseSkeleton,
} from './skeleton.js';

const T = '…';

/**
 * swapped：遗珍早已被转移。结构与 base 相同，各元素的作用改写：遗刻与最显眼的
 * 线索都指向原藏处，那里只剩当年转移遗珍的人留下的赝品；转移的痕迹才指向真藏处。
 * 夺宝者仍在说谎，但不知道原藏处是赝品。
 */
const SWAPPED_PURPOSES: Record<string, string> = {
  obj_forged:
    '遗珍原先的藏处：放着一件以假乱真的赝品（当年转移遗珍的人留下的障眼法），与遗刻所说的特征吻合',
  obj_place:
    '当年转移遗珍时留下的痕迹（记录、拖痕、新封条等），指明遗珍被移去的新藏处（新藏处本身另在一处，从外面看不出）',
  clue_legacy:
    '前辈遗刻的原话，说的是遗珍原先的藏处；遗珍后来被转移，遗刻已经不准',
  clue_place: '转移遗珍的痕迹或记录，指明遗珍被移去的新藏处',
  clue_debunk:
    '被误导者细看原藏处的“遗珍”后道出的破绽（材质、分量、年份对不上），证明那是赝品',
  clue_forged: '原藏处里的“遗珍”，与遗刻所述一模一样——其实是当年留下的赝品',
  clue_rumor: '被误导者转述的说法：他认定原藏处的遗珍就是真品，深信不疑',
  npc_rival:
    '夺宝者，以无害的身份出现，盯上了原藏处的遗珍，不知道那是赝品；想独吞遗珍',
  npc_decoy: '被原藏处的赝品骗了的人，真诚地相信遗珍就在原处，并替它作证',
  react_decoy_forged: '被出示原藏处的“遗珍”后细看，惊觉其中破绽，认出是赝品',
  evt_erase:
    '夺宝者察觉原藏处有异，循迹去找，趁你不备抹掉了转移遗珍的痕迹；预兆是夺宝者的异常举动，发生时只写你事后察觉某处被人动过、痕迹已被抹去，不写痕迹的具体内容',
  evt_leave:
    '被误导者等不及，抱着原藏处的赝品离开了遗迹；预兆是他越来越焦躁，发生时写他离去',
  'option:place_true': '真正的藏处：遗珍被转移后的新藏处，与转移的痕迹相符',
  'option:place_false': '干扰项：遗珍原先的藏处（遗刻所说之处，如今只剩赝品）',
  'option:place_rumor':
    '干扰项：照遗刻字面最容易误读出的另一处地点，与原藏处不是同一处',
};

/** retrieval 原型约定的身份槽位与结案问题。 */
const RETRIEVAL_SLOTS = ['rival', 'owner', 'decoy'] as const;
const RETRIEVAL_QUESTIONS = ['where', 'how', 'owner'] as const;

function assertRetrievalTemplate(template: MysteryScenarioTemplate) {
  for (const slot of RETRIEVAL_SLOTS)
    if (!template.roles.some((r) => r.slot === slot))
      throw new Error(`retrieval 模板缺少身份 ${slot}`);
  const ids = template.questions.map((q) => q.id).sort();
  if (ids.join() !== [...RETRIEVAL_QUESTIONS].sort().join())
    throw new Error('retrieval 模板的结案问题必须为 where、how、owner');
  for (const id of ['where', 'how'])
    if (template.questions.find((q) => q.id === id)?.answer_kind !== 'choice')
      throw new Error(`retrieval 模板的 ${id} 问题必须为选择题`);
}

const PLACE_OPTIONS = [
  ['place_true', '真正的藏处，与前辈遗刻、藏处痕迹相符'],
  ['place_false', '干扰项：夺宝者伪造的线索所指的地点'],
  [
    'place_rumor',
    '干扰项：照遗刻字面最容易误读出的地点，与伪造线索所指的不是同一处',
  ],
  ['place_other', '干扰项：另一处看似合理、但与遗刻不符的地点'],
] as const;

const METHOD_OPTIONS = [
  ['method_true', '真正的开禁法门，与禁制铭文和开禁关键一环相符'],
  ['method_forged', '干扰项：照搬伪造线索得出的法门'],
  ['method_force', '干扰项：以蛮力强破禁制'],
  ['method_other', '干扰项：另一种看似合理、但与铭文不符的法门'],
] as const;

/**
 * 生成遗珍寻踪骨架。随种子变化的有：房间数与连通、物证与人物站位、有无封闭密室、
 * 开禁关键一环由谁掌握（工具探查、守遗者或取得信任的应得之人）、夺宝者在来意还是行踪上说谎、
 * 守卫个数（0–2）。守卫只守加分房间，化解办法放在不经守卫也能拿到的地方。
 */
export function buildRetrievalSkeleton(
  template: MysteryScenarioTemplate,
  seed: number,
): MysteryCaseSkeleton {
  assertRetrievalTemplate(template);
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

  const keeperRole = template.roles.find((r) => r.slot === 'keeper');
  const withKeeper =
    Boolean(keeperRole && keeperRole.count[1] > 0) &&
    template.scale.npcs[1] >= 4 &&
    rng.chance(0.5);
  const methodVia = withKeeper ? 'keeper' : pick(['tool', 'owner'] as const);
  const lieAbout = pick(['purpose', 'whereabouts'] as const);
  const variant = pickMysteryVariant(template, seed);
  const withSealed = rng.chance(0.5);
  const roll = rng.next();
  const guardCount = roll < 0.2 ? 0 : roll < 0.7 ? 1 : 2;
  const sideCount = Math.max(
    2,
    Math.min(
      3,
      template.scale.rooms[1] - 2 - (withSealed ? 1 : 0) - guardCount,
    ),
  );
  const sides = int(2, sideCount);

  // 房间：入口、正殿（前辈遗刻与禁制所在）、若干偏殿，可能有封闭密室与守卫把守的静室（都是叶子）。
  const entrance = 'room_entrance';
  const hub = 'room_hub';
  const sealed = 'room_sealed';
  const extras = Array.from({ length: sides }, (_, i) => `room_side_${i + 1}`);
  const exits = new Map<string, string[]>([
    [entrance, [hub]],
    [hub, []],
  ]);
  const attached = [hub];
  for (const room of extras) {
    exits.get(pick(attached))!.push(room);
    exits.set(room, []);
    attached.push(room);
  }
  const openRooms = attached; // 不含入口、密室与守卫房间
  const sealedParent = pick(openRooms);
  if (withSealed) {
    exits.get(sealedParent)!.push(sealed);
    exits.set(sealed, []);
  }
  const guarded = Array.from(
    { length: guardCount },
    (_, i) => `room_guarded_${i + 1}`,
  );
  for (const room of guarded) {
    exits.get(pick(openRooms))!.push(room);
    exits.set(room, []);
  }

  const purposes: Record<string, string> = {
    [entrance]: '入口：玩家进场的地方，交代遗迹的样子',
    [hub]: '正殿：前辈留下遗刻与开禁铭文之处；遗珍不在这里',
    ...(withSealed
      ? { [sealed]: '封闭密室：前辈当年锁上的静室，进门只需钥匙' }
      : {}),
    ...Object.fromEntries(extras.map((r) => [r, '偏殿：遗迹中的其他房间'])),
    ...Object.fromEntries(
      guarded.map((r) => [
        r,
        '守卫把守的静室：藏着前辈留下的旁证，不进也能解谜',
      ]),
    ),
  };

  const rival = 'npc_rival';
  const owner = 'npc_owner';
  const decoy = 'npc_decoy';
  const keeper = 'npc_keeper';
  const rivalRoom = pick(openRooms);
  const ownerRoom = pick(openRooms);
  const decoyRoom = pick(openRooms.filter((r) => r !== rivalRoom));
  const keeperRoom = hub;

  const objects: MysteryCaseFile['objects'] = [];
  const object = (id: string, roomId: string, purpose: string) => {
    objects.push({ id, roomId, name: T, detail: T });
    purposes[id] = purpose;
  };
  object('obj_entrance', entrance, '入口处的痕迹，与遗珍无关，可作误导');
  object('obj_legacy', hub, '前辈留下的遗刻，话说得隐晦，提到遗珍的去处');
  object(
    'obj_seal',
    hub,
    methodVia === 'tool'
      ? '刻着开禁之法的铭文碑或阵盘（遗珍不在这里，封在别处看不出的暗藏禁制里）；细处的玄机需用工具探查'
      : '刻着开禁之法的铭文碑或阵盘（遗珍不在这里，封在别处看不出的暗藏禁制里），但缺了关键一环',
  );
  object(
    'obj_forged',
    pick(openRooms.filter((r) => r !== hub)),
    '夺宝者伪造的线索所在（改刻的图、调包的物件等），看起来指向另一处地点',
  );
  object(
    'obj_place',
    withSealed ? sealed : pick(openRooms.filter((r) => r !== hub)),
    withSealed
      ? '密室中前辈留下的痕迹，指明遗珍真正的藏处（藏处本身另在一处，从外面看不出）'
      : '不起眼的角落，留有指明遗珍真正藏处的痕迹（藏处本身另在一处，从外面看不出）',
  );
  object(
    'obj_record',
    pick(openRooms.filter((r) => r !== rivalRoom)),
    lieAbout === 'purpose'
      ? '记载往事的地方，有一条与夺宝者所称来意相悖的事实'
      : '记载往事的地方，有一条与夺宝者所称行踪相悖的事实',
  );
  object(
    'obj_mark',
    pick(openRooms),
    '刻着前辈一脉纹样的地方（只是印记，不是机关）',
  );
  if (methodVia === 'tool')
    object(
      'obj_tools',
      pick(openRooms),
      '堆放杂物之处，可以找到一件探查用的工具',
    );
  const keyAtMark = rng.chance(0.5);
  if (withSealed && !keyAtMark)
    object(
      'obj_keyspot',
      pick(openRooms.filter((r) => r !== sealedParent)),
      '一处不起眼的地方，藏着开启密室的钥匙',
    );
  guarded.forEach((room, i) =>
    object(
      `obj_cache_${i + 1}`,
      room,
      i === 0
        ? '前辈留下的手札或器物，旁证开禁的法门'
        : '前辈留下的遗书或器物，旁证遗珍该交给谁',
    ),
  );
  for (const [room] of exits) {
    if (!objects.some((o) => o.roomId === room))
      object(`obj_${room.replace('room_', '')}`, room, '此处的陈设，可供细看');
  }

  const items: MysteryCaseFile['items'] = [];
  const item = (id: string, objectId: string, purpose: string) => {
    items.push({ id, name: T, text: T, foundAt: { objectId } });
    purposes[id] = purpose;
  };
  if (withSealed)
    item(
      'item_key',
      keyAtMark ? 'obj_mark' : 'obj_keyspot',
      '前辈锁上静室用的钥匙',
    );
  if (methodVia === 'tool')
    item('item_tool', 'obj_tools', '能探查禁制铭文玄机的工具');
  if (guardCount >= 1)
    item(
      'item_pass',
      'obj_legacy',
      '前辈留下的令牌或符，能让第一个守卫认出来意、让路',
    );

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
    'clue_legacy',
    true,
    ['where'],
    '前辈遗刻的原话，隐晦地点出藏处的特征，真假两处藏处都勉强对得上',
    'obj_legacy',
  );
  clue(
    'clue_place',
    true,
    ['where'],
    '真正藏处留下的痕迹，与遗刻的特征吻合，与伪造线索所指之处对不上',
    'obj_place',
  );
  clue(
    'clue_record',
    true,
    ['where'],
    lieAbout === 'purpose'
      ? '记载中的事实，与夺宝者所称的来意矛盾，可当面戳穿'
      : '记载中的事实，与夺宝者所称的行踪矛盾，可当面戳穿',
    'obj_record',
  );
  clue(
    'clue_debunk',
    true,
    ['where'],
    '被误导者看清伪造线索后道出的破绽（新刻痕、材质不对、时日对不上），证明它是近日伪造',
  );
  clue(
    'clue_inscription',
    true,
    ['how'],
    '铭文碑上写明开禁的大致法门，但缺了关键一环',
    'obj_seal',
  );
  clue(
    'clue_method',
    true,
    ['how'],
    methodVia === 'tool'
      ? '开禁的关键一环，用工具探查禁制铭文后才发现'
      : methodVia === 'keeper'
        ? '守遗者见你读过铭文后，道出开禁的关键一环'
        : '应得之人取得信任后，道出家中代代相传的开禁关键一环',
  );
  clue(
    'clue_mark',
    true,
    ['owner'],
    '前辈一脉的纹样，与应得之人的信物同源',
    'obj_mark',
  );
  clue(
    'clue_token',
    true,
    ['owner'],
    '应得之人出示的信物，纹样与前辈一脉相同，证明其来历',
  );
  guarded.forEach((_, i) =>
    clue(
      `clue_cache_${i + 1}`,
      true,
      i === 0 ? ['how'] : ['owner'],
      i === 0
        ? '前辈手札中的旁证，印证开禁的法门'
        : '前辈遗书中的旁证，印证遗珍该交给谁',
      `obj_cache_${i + 1}`,
    ),
  );
  clue(
    'clue_forged',
    false,
    [],
    '夺宝者伪造的线索：看起来出自前辈之手，指向错误的藏处与错误的开禁法门',
    'obj_forged',
  );
  clue(
    'clue_claim',
    false,
    [],
    lieAbout === 'purpose'
      ? '夺宝者关于自己来意的说法（是谎言）'
      : '夺宝者关于自己近日行踪的说法（是谎言）',
  );
  clue(
    'clue_rumor',
    false,
    [],
    '被误导者转述的说法：他照伪造线索认定的藏处，深信不疑',
  );
  clue(
    'clue_entrance',
    false,
    [],
    '入口处的误导痕迹，有合理的其他解释',
    'obj_entrance',
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
      rival,
      'rival',
      rivalRoom,
      '夺宝者，以无害的身份出现，暗中伪造线索把旁人引向错误的藏处，想独吞遗珍',
      {
        secrets: [
          { clueId: 'clue_claim', requires: { visited: hub }, line: T },
        ],
        reactions: [
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
    npc(owner, 'owner', ownerRoom, '遗珍真正该交付的人，起初戒备，不轻易交底', {
      secrets:
        methodVia === 'owner'
          ? [
              {
                clueId: 'clue_method',
                requires: { flag: 'owner_trusted' },
                line: T,
              },
            ]
          : [],
      reactions: [
        {
          id: 'react_owner_mark',
          evidenceId: 'clue_mark',
          line: T,
          effects: [
            { kind: 'reveal_clue', clueId: 'clue_token' },
            { kind: 'set_flag', flag: 'owner_trusted' },
          ],
          exposesLie: false,
        },
      ],
    }),
    npc(
      decoy,
      'decoy',
      decoyRoom,
      '被夺宝者的假线索骗了的人，真诚地相信错误的藏处，并替假线索作证',
      {
        secrets: [
          { clueId: 'clue_rumor', requires: { visited: hub }, line: T },
        ],
        reactions: [
          {
            id: 'react_decoy_forged',
            evidenceId: 'clue_forged',
            line: T,
            effects: [
              { kind: 'reveal_clue', clueId: 'clue_debunk' },
              { kind: 'set_flag', flag: 'decoy_turned' },
            ],
            exposesLie: false,
          },
        ],
      },
    ),
  ];
  if (withKeeper)
    npcs.push(
      npc(
        keeper,
        'keeper',
        keeperRoom,
        '守遗者（残魂、器灵或老仆），守着禁制，知道开禁的关键一环',
        {
          secrets: [
            {
              clueId: 'clue_method',
              requires: { has_clue: 'clue_inscription' },
              line: T,
            },
          ],
          reactions: [],
        },
      ),
    );
  purposes[`${rival}:clue_claim`] =
    lieAbout === 'purpose'
      ? '玩家到过正殿后再问，夺宝者说出关于自己来意的谎言'
      : '玩家到过正殿后再问，夺宝者说出关于自己近日行踪的谎言';
  purposes[`${decoy}:clue_rumor`] =
    '玩家到过正殿后再问，被误导者说出深信的传闻';
  if (methodVia === 'owner')
    purposes[`${owner}:clue_method`] =
      '取得信任后再问，应得之人说出家传的开禁关键一环';
  if (withKeeper)
    purposes[`${keeper}:clue_method`] =
      '玩家读过禁制铭文后再问，守遗者说出开禁的关键一环';
  purposes.react_rival_record = '被记载当面戳穿谎言时的慌乱与狡辩';
  purposes.react_owner_mark = '被出示纹样后，拿出纹样相同的信物、放下戒备';
  purposes.react_decoy_forged =
    '被出示伪造线索后细看，惊觉其中破绽，说出是谁近日来过';

  const guards: NonNullable<MysteryCaseFile['guards']> = guarded.map(
    (room, i) => {
      const id = `guard_${i + 1}`;
      purposes[id] =
        i === 0
          ? '守在静室门口的傀儡、阵灵或妖兽；持前辈的令牌可令其让路'
          : '守在静室门口的傀儡、阵灵或妖兽；认得前辈一脉，应得之人信任你后，借其信物或口令即可令其退下';
      return {
        id,
        roomId: room,
        name: T,
        description: T,
        bypass: i === 0 ? { has_item: 'item_pass' } : { flag: 'owner_trusted' },
        bypassText: T,
      };
    },
  );

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
              id: 'use_tool_seal',
              itemId: 'item_tool',
              targetId: 'obj_seal',
              text: T,
              effects: [{ kind: 'reveal_clue', clueId: 'clue_method' }],
            },
          ]
        : [],
    questions: [
      {
        id: 'where',
        options: options(PLACE_OPTIONS),
        answer: 'place_true',
        explanation: T,
      },
      {
        id: 'how',
        options: options(METHOD_OPTIONS),
        answer: 'method_true',
        explanation: T,
      },
      { id: 'owner', answer: owner, explanation: T },
    ],
    ...(guards.length ? { guards } : {}),
    // 夺宝者抹去真藏处的痕迹；被误导者照假线索离去。玩家抢先一步即可阻止。
    events: [
      {
        id: 'evt_erase',
        ...eventTurns(template, 0.4, 0.5),
        unless: {
          any: [{ has_clue: 'clue_place' }, { flag: 'rival_exposed' }],
        },
        warning: T,
        text: T,
        effects: [{ kind: 'destroy_object', objectId: 'obj_place' }],
      },
      {
        id: 'evt_leave',
        ...eventTurns(template, 0.55, 0.65),
        unless: { flag: 'decoy_turned' },
        warning: T,
        text: T,
        effects: [{ kind: 'npc_leave', npcId: decoy }],
      },
    ],
  };
  purposes.evt_erase =
    '夺宝者察觉你在追查，趁你不备去抹掉真藏处留下的痕迹；预兆是夺宝者的异常举动，发生时只写你事后察觉某处被人动过、痕迹已被抹去，不写痕迹的具体内容';
  purposes.evt_leave =
    '被误导者等不及，照伪造线索独自去假藏处挖宝，离开了遗迹；预兆是他越来越焦躁，发生时写他离去';
  if (methodVia === 'tool')
    purposes.use_tool_seal = '用工具探查禁制铭文，发现开禁的关键一环';
  if (variant === 'swapped') {
    purposes[`${decoy}:clue_rumor`] =
      '玩家到过正殿后再问，被误导者说出他深信的原藏处';
    Object.assign(purposes, SWAPPED_PURPOSES);
  }
  return { caseFile, purposes };
}
