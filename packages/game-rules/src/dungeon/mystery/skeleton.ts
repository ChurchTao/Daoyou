import { SeededRng } from '@daoyou/combat-core/rng';
import type {
  MysteryCaseFile,
  MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';

/** 文本占位符；骨架里所有面向玩家的文字都由 LLM 之后填写。 */
export const MYSTERY_TEXT_PLACEHOLDER = '…';

/**
 * 案卷骨架：结构（房间图、线索获取链、锁与钥匙、谎言与戳穿、答案）由程序确定，
 * 保证可解；`purposes` 告诉 LLM 每个元素在谜题中承担什么作用。
 * secret 的键为 `${npcId}:${clueId}`。
 */
export interface MysteryCaseSkeleton {
  caseFile: MysteryCaseFile;
  purposes: Record<string, string>;
}

const T = MYSTERY_TEXT_PLACEHOLDER;

/** whodunit 原型约定的身份槽位与结案问题。 */
const WHODUNIT_SLOTS = ['culprit', 'heir'] as const;
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
}

/**
 * 生成 whodunit 骨架。同一模板与种子总是得到同一骨架；
 * 房间数、连通方式、物证与工具的位置、人物站位和旁人有无随种子变化。
 */
export function buildMysterySkeleton(
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
    template.scale.npcs[1] >= 3 &&
    (template.scale.npcs[0] >= 3 || rng.chance(0.5));

  // 房间：入口、中枢（死者所在）、作案处、若干旁室、封闭密室（叶子，需钥匙）。
  const entrance = 'room_entrance';
  const hub = 'room_hub';
  const crime = 'room_crime';
  const sealed = 'room_sealed';
  const extras = Array.from(
    { length: roomCount - 4 },
    (_, i) => `room_side_${i + 1}`,
  );
  const exits = new Map<string, string[]>([
    [entrance, [hub]],
    [hub, [crime]],
    [crime, []],
    [sealed, []],
  ]);
  const attached = [hub, crime];
  for (const room of extras) {
    exits.get(pick(attached))!.push(room);
    exits.set(room, []);
    attached.push(room);
  }
  const sealedParent = pick(attached);
  exits.get(sealedParent)!.push(sealed);
  const openRooms = attached; // 不含入口与密室

  const purposes: Record<string, string> = {
    [entrance]: '入口：玩家进场的地方，交代此地的样子',
    [hub]: '中枢：洞府主人遗骸所在之处',
    [crime]: '作案处：凶手当年动手的地方，留有作案器物',
    [sealed]: '封闭密室：凶手当年用钥匙锁上、在此藏了罪证；进门只需钥匙',
    ...Object.fromEntries(extras.map((r) => [r, '旁室：洞府中的其他房间'])),
  };

  // 人物站位。
  const culprit = 'npc_culprit';
  const heir = 'npc_heir';
  const witness = 'npc_witness';
  const culpritRoom = pick(openRooms);
  const heirRoom = sealedParent;
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
    '凶手作案用到的器物，表面看不出异样，需要工具探查',
  );
  const toolRoom = pick([crime, ...extras]);
  object('obj_tools', toolRoom, '放着杂物的地方，可以找到一件探查用的工具');
  const recordRoom = pick(openRooms.filter((r) => r !== hub) as string[]);
  object(
    'obj_record',
    recordRoom,
    '存放记录的地方，记载着与凶手身份相悖的事实',
  );
  object('obj_seal', sealedParent, '封闭密室的门，刻着洞府主人一脉的纹样（只是印记，不是机关）');
  object('obj_hidden', sealed, '凶手藏在密室里的东西');
  const keyAtRemains = rng.chance(0.5);
  if (!keyAtRemains) {
    const keyRoom = pick(openRooms.filter((r) => r !== sealedParent));
    object('obj_keyspot', keyRoom, '一处不起眼的地方，藏着开启密室的钥匙');
  }
  const herringObjectRoom = extras.length ? pick(extras) : crime;
  // 误导线索：入口痕迹、凶手的谎言，再加旁人传闻或一件可疑物件，共 3 条。
  const extraHerring = !withWitness;
  if (extraHerring)
    object('obj_herring', herringObjectRoom, '看似可疑、实则与案情无关的东西');
  for (const [room] of exits) {
    if (!objects.some((o) => o.roomId === room))
      object(`obj_${room.replace('room_', '')}`, room, '此处的陈设，可供细看');
  }

  const items: MysteryCaseFile['items'] = [
    {
      id: 'item_key',
      name: T,
      text: T,
      foundAt: { objectId: keyAtRemains ? 'obj_remains' : 'obj_keyspot' },
    },
    { id: 'item_tool', name: T, text: T, foundAt: { objectId: 'obj_tools' } },
  ];
  purposes.item_key = '凶手当年锁密室用的钥匙，后来遗落在洞府里';
  purposes.item_tool = '能探查作案器物的工具';

  // 线索：6 条关键线索，覆盖三个结案问题；误导线索 1–3 条。
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
    '遗骸上指向凶手身份的痕迹（残缺、需与其他线索互证）',
    'obj_remains',
  );
  clue(
    'clue_method',
    true,
    ['how'],
    '作案手段的直接证据，用工具探查作案器物后才发现',
  );
  clue(
    'clue_record',
    true,
    ['who'],
    '记录中的事实，与凶手的说法矛盾，可当面戳穿',
    'obj_record',
  );
  clue(
    'clue_hidden',
    true,
    ['who'],
    '凶手藏在密室里、能证明其身份的东西',
    'obj_hidden',
  );
  clue(
    'clue_seal',
    true,
    ['heir'],
    '密室门上洞府主人一脉的纹样，与传人的信物同源（开门靠钥匙，不靠信物）',
    'obj_seal',
  );
  clue('clue_token', true, ['heir'], '传人出示的祖传信物，纹样与门上相同，证明其血脉');
  clue(
    'clue_entrance',
    false,
    [],
    '入口处的误导痕迹，有合理的其他解释',
    'obj_entrance',
  );
  clue('clue_claim', false, [], '凶手关于自己身份与来历的说法（是谎言）');
  if (extraHerring)
    clue(
      'clue_herring',
      false,
      [],
      '一件看似可疑、其实另有缘由的东西',
      'obj_herring',
    );
  if (withWitness)
    clue('clue_rumor', false, [], '旁人听来的传闻，只说对了一半');

  const npcs: MysteryCaseFile['npcs'] = [
    {
      id: culprit,
      name: T,
      title: T,
      role: 'culprit',
      roomId: culpritRoom,
      greeting: T,
      idleLine: T,
      deflectLine: T,
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
    {
      id: heir,
      name: T,
      title: T,
      role: 'heir',
      roomId: heirRoom,
      greeting: T,
      idleLine: T,
      deflectLine: T,
      secrets: [],
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
    },
  ];
  purposes[culprit] = '真凶，以伪装身份出现，有求于玩家';
  purposes[heir] = '真正的传人，守在密室门前，起初戒备；不知道钥匙在哪';
  purposes[`${culprit}:clue_claim`] =
    '玩家到过作案处后再问，凶手说出关于自己来历的谎言';
  purposes.react_culprit_record = '被记录当面戳穿谎言时的慌乱';
  purposes.react_heir_seal = '被出示门上纹样后，拿出纹样相同的祖传信物、放下戒备';
  if (withWitness) {
    npcs.push({
      id: witness,
      name: T,
      title: T,
      role: 'witness',
      roomId: witnessRoom,
      greeting: T,
      idleLine: T,
      deflectLine: T,
      secrets: [{ clueId: 'clue_rumor', requires: { visited: hub }, line: T }],
      reactions: [],
    });
    purposes[witness] = '旁人，知道一部分事实但看不清全貌';
    purposes[`${witness}:clue_rumor`] =
      '玩家见过遗骸后再问，旁人说出听来的传闻';
  }

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
      ...(id === sealed
        ? { requires: { has_item: 'item_key' }, lockedText: T }
        : {}),
    })),
    objects,
    clues,
    items,
    npcs,
    interactions: [
      {
        id: 'use_tool_method',
        itemId: 'item_tool',
        targetId: 'obj_method',
        text: T,
        effects: [{ kind: 'reveal_clue', clueId: 'clue_method' }],
      },
    ],
    questions: [
      { id: 'who', answer: culprit, explanation: T },
      { id: 'how', answer: 'clue_method', explanation: T },
      { id: 'heir', answer: heir, explanation: T },
    ],
  };
  purposes.use_tool_method = '用工具探查作案器物，发现作案手段';
  return { caseFile, purposes };
}
