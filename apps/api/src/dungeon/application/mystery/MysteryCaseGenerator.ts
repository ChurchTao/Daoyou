import { getMysteryFallbackCase } from '@daoyou/game-content/dungeon/scenarios';
import {
  MysteryCaseFileSchema,
  type MysteryCaseFile,
  type MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import type {
  DungeonScenarioConfig,
  SatelliteNode,
} from '@daoyou/game-domain/world/map';
import {
  buildMysterySkeleton,
  renderHintRule,
  validateMysteryCase,
  type MysteryCaseSkeleton,
} from '@daoyou/game-rules/dungeon/mystery';
import type { LlmSceneId } from '@server/lib/llm/types.js';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { z } from 'zod';
import {
  cleanMysteryText as clip,
  reviewMysteryCase,
} from './MysteryCaseReview.js';

const STAGE_TIMEOUT_MS = 60_000;

/** 各骨架共同约定：说谎者的原话写在这条线索里。 */
const CLAIM_CLUE = 'clue_claim';
/** 由程序渲染、审校时不允许改写的字段。 */
const LOCKED_FIELDS = [`clues.${CLAIM_CLUE}.text`];

/**
 * 案型描述：说谎的人物、真相中必须点名的人物、大纲里需要先定下的事实设定（canon）
 * 以及写真相时要遵守的骨架约定。新增案型只需在此登记。
 */
interface MysteryArchetypeSpec {
  liar: string;
  liarLabel: string;
  cast: readonly string[];
  canon: Record<string, string>;
  rules: readonly string[];
}

const ARCHETYPES: Partial<
  Record<MysteryScenarioTemplate['archetype'], MysteryArchetypeSpec>
> = {
  whodunit: {
    liar: 'npc_culprit',
    liarLabel: '凶手',
    cast: ['npc_culprit', 'npc_heir'],
    canon: {
      victim: '洞府主人的名字、身份与表面死因',
      culprit: '凶手的真名、伪装身份与动机',
      method: '作案手段：用了什么东西、怎样下手、留下什么痕迹',
      lie: '凶手对外宣称来历的第一人称原话（“我……”），一两句，不加引号、不写“某某谎称”；与其称谓 title 一致',
      contradiction: 'clue_record 记载的哪条事实与 lie 矛盾',
      suspect: '嫌疑人为何被怀疑（可疑物证从何而来）、清白的真相与可核实的凭据',
      token: '传人的祖传信物是什么样子；其纹样与洞府主人一脉的印记相同',
    },
    rules: [
      '凶手是 npc_culprit，传人是 npc_heir，npc_suspect 是被冤枉的嫌疑人（有可疑物证，但有清白的缘由与凭据）。',
      '作案手段、谎言与戳穿它的记录、罪证藏在哪里、信物如何证明血脉，都以各元素的“作用”为准。',
      '骨架里有封闭密室时，开门靠钥匙，门上纹样只是洞府主人一脉的印记。',
      '“手段”一问的选项：真相一项必须与手段线索一致，干扰项要说得通、但与物证不符。',
    ],
  },
  retrieval: {
    liar: 'npc_rival',
    liarLabel: '夺宝者',
    cast: ['npc_rival', 'npc_owner'],
    canon: {
      legacy: '留下遗珍的前辈是谁、遗珍是什么、为何封存',
      rival: '夺宝者的真名、对外身份与图谋',
      place: '遗珍真正的藏处在哪、有什么特征；伪造线索所指的假藏处在哪',
      method: '开禁法门：铭文写明的部分与缺失的关键一环分别是什么',
      lie: '夺宝者对外宣称来意或行踪的第一人称原话（“我……”），一两句，不加引号、不写“某某谎称”；与其称谓 title 一致',
      contradiction: 'clue_record 记载的哪条事实与 lie 矛盾',
      forged:
        '伪造线索是什么、何时由谁伪造、破绽在哪；被误导者为何深信、看出破绽后如何改口',
      token: '应得之人的信物是什么样子；其纹样与前辈一脉的印记相同',
    },
    rules: [
      '夺宝者是 npc_rival，应得之人是 npc_owner，npc_decoy 是被假线索骗了的人（真心相信，不是同伙），npc_keeper（如有）是守遗者。',
      '遗珍真正的藏处、开禁法门、伪造线索与它的破绽、信物如何证明来历，都以各元素的“作用”为准；遗珍此刻仍封在真藏处的暗藏禁制里，从外面看不出，没有人取出过；正殿只有遗刻与开禁铭文，遗珍不在正殿。',
      '骨架里有封闭密室时，开门靠钥匙，门上纹样只是前辈一脉的印记。守卫拦在静室门口，可强闯，也可凭“作用”所述的办法化解。',
      '“藏处”与“法门”两问的选项：四个选项各不相同；真相一项必须与线索一致，干扰项要说得通、但与物证不符；假藏处与伪造线索所指一致，另两个干扰项是别的地点。',
    ],
  },
  unlock: {
    liar: 'npc_rival',
    liarLabel: '闯关者',
    cast: ['npc_rival', 'npc_fallen'],
    canon: {
      legacy: '设下试炼的前辈是谁、为何设下、闯过者能得到什么',
      trial: '主禁制与两处机关各是什么样子；部件取什么成套的物象',
      catalyst: '开启主禁制的引子是什么、为何是它',
      rival: '闯关者的真名、来历与图谋；当年如何把假解法给了前人',
      lie: '闯关者对外宣称来历或与前人关系的第一人称原话（“我……”），一两句，不加引号、不写“某某谎称”；与其称谓 title 一致',
      contradiction: 'clue_record 记载的哪条事实与 lie 矛盾',
      fallen: '前人是谁、何时在此失败、自以为的原因与真正的原因',
    },
    rules: [
      '守试者是 npc_warden，闯关者是 npc_rival，前人是 npc_fallen；前人当年是照闯关者给的假解法操作才触发反噬，他自己却以为是记错了一步。',
      '两处机关与主禁制的具体解法由程序决定，提示原话也由程序补上；你只为机关与部件起名、写外观与情形，不要在任何文字里写出机关的解法或次序。',
      '同一机关的四个部件名称成套（如卦象、四象、五行、星宿、此地特有的器物），每个两到四字，彼此不同。',
      '“引子”与“前人失败原因”两问的选项：真相一项必须与线索一致，干扰项要说得通、但与线索不符。',
    ],
  },
};

function archetypeOf(template: MysteryScenarioTemplate) {
  const spec = ARCHETYPES[template.archetype];
  if (!spec) throw new Error(`暂不支持原型 ${template.archetype} 的案卷生成`);
  return spec;
}

const Text = (limit: number, hint: string) =>
  z.string().describe(`${hint}，${limit} 字以内`);

/** 以骨架中的 id 为固定键：模型只能逐一填写，无法增删或写错引用。 */
function keyed<S extends z.ZodType>(
  ids: readonly string[],
  value: (id: string) => S,
) {
  return z.object(Object.fromEntries(ids.map((id) => [id, value(id)])));
}

function ids(skeleton: MysteryCaseSkeleton) {
  const c = skeleton.caseFile;
  return {
    rooms: c.rooms.map((r) => r.id),
    lockedRooms: c.rooms.filter((r) => r.requires).map((r) => r.id),
    objects: c.objects.map((o) => o.id),
    clues: c.clues.map((x) => x.id),
    items: c.items.map((i) => i.id),
    npcs: c.npcs.map((n) => n.id),
    secrets: c.npcs.flatMap((n) => n.secrets.map((s) => `${n.id}:${s.clueId}`)),
    reactions: c.npcs.flatMap((n) => n.reactions.map((r) => r.id)),
    interactions: c.interactions.map((i) => i.id),
    questions: c.questions.map((q) => q.id),
    // 由程序渲染说法的选项（主禁制次序）不交给模型。
    options: c.questions.flatMap(
      (q) =>
        q.options?.map((o) => o.id).filter((id) => !skeleton.sequences?.[id]) ??
        [],
    ),
    mechanisms: (c.mechanisms ?? []).map((m) => m.id),
    smallMechanisms: (c.mechanisms ?? [])
      .filter((m) => !m.final)
      .map((m) => m.id),
    parts: (c.mechanisms ?? []).flatMap((m) => m.parts.map((p) => p.id)),
    guards: (c.guards ?? []).map((g) => g.id),
    events: (c.events ?? []).map((e) => e.id),
  };
}

function outlineSchema(
  skeleton: MysteryCaseSkeleton,
  spec: MysteryArchetypeSpec,
) {
  const id = ids(skeleton);
  const p = skeleton.purposes;
  const name = (limit: number) => (key: string) =>
    Text(limit, `名称；作用：${p[key]}`);
  // 字段顺序即生成顺序：先定名字与事实，最后写真相，真相才能与名字一致。
  return z.object({
    npcs: keyed(id.npcs, (key) =>
      z.object({
        name: Text(
          6,
          `人物在全案中唯一使用的名字，姓氏从 naming.surnames 中选、彼此不同；不能言语者可用称号；作用：${p[key]}`,
        ),
        title: Text(
          8,
          `对外身份称谓；${spec.liarLabel}的称谓即其对外宣称的身份，全案提到时都用这个称谓`,
        ),
        nature: Text(
          40,
          '此人真实是什么人（种族、来历、能否言语），全案以此为准',
        ),
        relation: Text(60, '玩家进场时已知的表面关系，不泄露真相'),
      }),
    ),
    rooms: keyed(id.rooms, name(8)),
    objects: keyed(id.objects, name(8)),
    items: keyed(id.items, name(8)),
    guards: keyed(id.guards, name(8)),
    mechanisms: keyed(id.mechanisms, name(8)),
    parts: keyed(id.parts, (key) =>
      Text(
        4,
        `机关部件的名称，两到四字，与同一机关的其余三个部件成套；作用：${p[key]}`,
      ),
    ),
    clues: keyed(id.clues, (key) =>
      z.object({
        name: Text(8, `线索名称；作用：${p[key]}`),
        fact: Text(50, '这条线索揭示的核心事实，一句话，后续正文必须与之一致'),
      }),
    ),
    canon: z.object(
      Object.fromEntries(
        Object.entries(spec.canon).map(([key, hint]) => [
          key,
          Text(key === 'lie' ? 50 : 60, hint),
        ]),
      ) as Record<string, z.ZodString>,
    ),
    options: keyed(id.options, (key) =>
      Text(
        16,
        `结案选择题的选项说法，只写地点或做法本身，不带“伪”“假”“错”等透露对错的字眼；作用：${p[`option:${key}`]}`,
      ),
    ),
    title: Text(12, '案卷标题'),
    truth: Text(
      500,
      '完整真相：以第三人称写成此地发生过的往事经过（谁、为何、如何、事后做了什么），不写玩家的调查过程，不用“你”；只用上面定下的名字，与 canon 和各线索 fact 一致',
    ),
    brief: z.object({
      identity: Text(100, '玩家此行的身份'),
      goal: Text(100, '玩家此行的目的'),
      opening: Text(300, '开场一幕，第二人称'),
    }),
  });
}

type Outline = z.infer<ReturnType<typeof outlineSchema>>;

/**
 * 每个事实只在一处写具体：线索正文是物证细节的唯一出处；房间描写只写空间，
 * 藏有线索的物件只写引人注意的一句，交互与解析只写动作与引用。
 * 同一物证不再在多处各自描写，前后不一也就无从产生。
 */
function cueObjects(s: MysteryCaseSkeleton) {
  const c = s.caseFile;
  return new Set([
    ...[...c.clues, ...c.items].flatMap((x) =>
      x.foundAt ? [x.foundAt.objectId] : [],
    ),
    ...c.interactions.map((i) => i.targetId),
  ]);
}

const TEXT_PARTS = {
  places: {
    task: '为每个房间写初次进入的描写与再次进入的一句话；有进入条件的房间写受阻描写；为每个守卫写拦路的样子与被化解时的情形；为每个随时间发生的事件写预兆与发生时的情形（第二人称，只写你察觉到的）；为每个物件写细看后的描写。房间描写只写空间、光线、气味与在场人物的姿态，不描写任何物件的细节（物件会单独列出）；会因事件离场的人物（见 case.events 的 affects）不写进房间描写。物件分两种：藏有线索或可被探查的物件只写一句引人注意的异样，不写具体发现，具体发现由线索正文呈现；其余物件可以细写陈设。',
    schema: (s: MysteryCaseSkeleton) => {
      const id = ids(s);
      const cues = cueObjects(s);
      return z.object({
        rooms: keyed(id.rooms, (room) =>
          z.object({
            description: Text(
              160,
              `初次进入的描写，只写空间与人物，不写物件细节；作用：${s.purposes[room]}`,
            ),
            brief: Text(30, '再次进入时的一句话'),
            ...(id.lockedRooms.includes(room)
              ? {
                  lockedText: Text(
                    50,
                    '门锁着、需要钥匙才能打开的样子；门上的纹样只是印记',
                  ),
                }
              : {}),
          }),
        ),
        guards: keyed(id.guards, (g) =>
          z.object({
            description: Text(
              120,
              `守卫拦在门口的样子与气势，不写化解办法；作用：${s.purposes[g]}`,
            ),
            bypassText: Text(
              120,
              `你用化解办法令它让路时的情形；作用：${s.purposes[g]}`,
            ),
          }),
        ),
        mechanisms: keyed(id.smallMechanisms, (m) =>
          z.object({
            solvedText: Text(
              100,
              `按对次序后机关开启的情形，不写开启后得到的内容；作用：${s.purposes[m]}`,
            ),
            backlashText: Text(
              80,
              `按错次序时机关反噬的情形（气血翻涌、禁光反震等）；作用：${s.purposes[m]}`,
            ),
          }),
        ),
        events: keyed(id.events, (e) =>
          z.object({
            warning: Text(
              80,
              `事件发生前的预兆，只写看得见的异常举动，不点破意图；作用：${s.purposes[e]}`,
            ),
            text: Text(
              120,
              `事件发生时你察觉到的情形与后果；作用：${s.purposes[e]}`,
            ),
          }),
        ),
        objects: keyed(id.objects, (o) =>
          cues.has(o)
            ? Text(
                40,
                `一句引人注意的异样，不写具体发现；作用：${s.purposes[o]}`,
              )
            : Text(150, `细看后的陈设描写；作用：${s.purposes[o]}`),
        ),
      });
    },
  },
  evidence: {
    task: '线索正文是物证细节的唯一出处：为每条线索写玩家看到或听到的事实，以该线索的 fact 为核心写具体（什么东西、在哪、什么样），不得改变 fact 中的名称、物质、部位、数量与时间，不替玩家下结论；为每件物品写一句说明；为物品交互只写使用的动作与当下的感官反应，发现的内容留给随后出现的线索正文；为每个结案问题写答案为何成立，只用线索名称引用证据，不重新描写物证细节。',
    schema: (s: MysteryCaseSkeleton) => {
      const id = ids(s);
      return z.object({
        clues: keyed(id.clues, (c) =>
          Text(140, `线索事实；作用：${s.purposes[c]}`),
        ),
        items: keyed(id.items, (i) =>
          Text(100, `物品说明；作用：${s.purposes[i]}`),
        ),
        interactions: keyed(id.interactions, (i) =>
          Text(80, `使用的动作与当下的感官反应；作用：${s.purposes[i]}`),
        ),
        explanations: keyed(id.questions, () =>
          Text(150, '答案解析，只用线索名称引用证据'),
        ),
      });
    },
  },
  people: {
    task: '提到任何人物的对外身份时只用其 title，不另起说法；为每个人物写初见台词、无话可说时的台词、被出示无关证据时的台词，言行符合其 nature（不能言语者只写动作）；为每条秘密写说出时的台词，内容与对应线索的 fact 一致；说谎者（case.liar）说谎的那条秘密只写说话前的神态动作，原话由程序补上；为每个反应写被出示证据时的言行，只提证据名称，不重新描写证据细节。人物只知道自己 nature 与 truth 中该知道的事，不说破玩家尚未发现的线索；说谎者的初见台词不提谎言所涉之事。',
    schema: (s: MysteryCaseSkeleton) => {
      const id = ids(s);
      return z.object({
        npcs: keyed(id.npcs, (n) =>
          z.object({
            greeting: Text(160, `初见台词；作用：${s.purposes[n]}`),
            idleLine: Text(90, '无话可说时的台词'),
            deflectLine: Text(90, '被出示无关证据时的台词'),
          }),
        ),
        secrets: keyed(id.secrets, (k) =>
          k.endsWith(`:${CLAIM_CLUE}`)
            ? Text(60, '凶手说出谎言前的神态动作，不写台词')
            : Text(180, `说出秘密时的台词；作用：${s.purposes[k]}`),
        ),
        reactions: keyed(id.reactions, (r) =>
          Text(180, `被出示证据时的言行；作用：${s.purposes[r]}`),
        ),
      });
    },
  },
} as const;

type TextPart = keyof typeof TEXT_PARTS;

/** 供文本阶段参考的结构摘要：名称、作用与获取方式，不含任何 id 以外的推断。 */
function structureContext(
  s: MysteryCaseSkeleton,
  o: Outline,
  spec: MysteryArchetypeSpec,
) {
  const c = s.caseFile;
  const nameOf = (id: string) =>
    o.rooms[id] ??
    o.objects[id] ??
    o.clues[id]?.name ??
    o.items[id] ??
    o.npcs[id]?.name ??
    o.guards[id] ??
    id;
  return {
    title: o.title,
    truth: o.truth,
    canon: o.canon,
    liar: o.npcs[spec.liar]?.name,
    rooms: c.rooms.map((r) => ({
      id: r.id,
      name: nameOf(r.id),
      purpose: s.purposes[r.id],
      exits: r.exits.map(nameOf),
      locked: Boolean(r.requires),
    })),
    objects: c.objects.map((x) => ({
      id: x.id,
      name: nameOf(x.id),
      room: nameOf(x.roomId),
      holds: [...c.clues, ...c.items]
        .filter((y) => y.foundAt?.objectId === x.id)
        .map((y) => nameOf(y.id)),
    })),
    clues: c.clues.map((x) => ({
      id: x.id,
      name: nameOf(x.id),
      key: x.key,
      fact: o.clues[x.id]?.fact,
      purpose: s.purposes[x.id],
    })),
    items: c.items.map((x) => ({ id: x.id, name: nameOf(x.id) })),
    npcs: c.npcs.map((n) => ({
      id: n.id,
      name: o.npcs[n.id]?.name,
      title: o.npcs[n.id]?.title,
      nature: o.npcs[n.id]?.nature,
      role: n.role,
      room: nameOf(n.roomId),
      secrets: n.secrets.map((x) => ({
        key: `${n.id}:${x.clueId}`,
        clue: nameOf(x.clueId),
      })),
      reactions: n.reactions.map((x) => ({
        id: x.id,
        evidence: nameOf(x.evidenceId),
      })),
    })),
    interactions: c.interactions.map((x) => ({
      id: x.id,
      item: nameOf(x.itemId),
      target: nameOf(x.targetId),
    })),
    guards: (c.guards ?? []).map((g) => ({
      id: g.id,
      name: nameOf(g.id),
      room: nameOf(g.roomId),
      purpose: s.purposes[g.id],
    })),
    mechanisms: (c.mechanisms ?? []).map((m) => ({
      id: m.id,
      name: o.mechanisms?.[m.id],
      at: nameOf(m.objectId),
      final: m.final,
      parts: m.parts.map((p) => o.parts?.[p.id]),
      purpose: s.purposes[m.id],
    })),
    events: (c.events ?? []).map((e) => ({
      id: e.id,
      purpose: s.purposes[e.id],
      affects: e.effects.map((x) =>
        x.kind === 'destroy_object'
          ? nameOf(x.objectId)
          : x.kind === 'npc_leave'
            ? nameOf(x.npcId)
            : x.kind === 'lock_mechanism'
              ? (o.mechanisms?.[x.mechanismId] ?? x.mechanismId)
              : x.flag,
      ),
    })),
    answers: c.questions.map((q) => ({
      id: q.id,
      answer: q.options
        ? str(o.options, q.answer) || q.answer
        : nameOf(q.answer),
    })),
  };
}

const str = (record: Record<string, unknown>, key: string) =>
  String(record[key] ?? '');

async function callStage<S extends z.ZodType>(args: {
  promptId: 'dungeon-case' | 'dungeon-case-text';
  sceneId: LlmSceneId;
  name: string;
  schema: S;
  context: unknown;
}): Promise<z.infer<S>> {
  const prompt = renderPrompt(args.promptId, {
    userContextJson: stableCompactStringify(args.context),
  });
  const run = () =>
    generateAiObject({
      system: prompt.system,
      prompt: prompt.user,
      schema: args.schema,
      name: args.name,
      sceneId: args.sceneId,
      timeoutMs: STAGE_TIMEOUT_MS,
    });
  // 结构已经固定，失败只可能是网络、输出截断或个别字段留空，单段重试一次即可。
  const first = await run().catch(() => null);
  if (first && !hasEmptyText(first.output)) return first.output as z.infer<S>;
  const second = await run().catch((error: unknown) => {
    if (first) return first;
    throw error;
  });
  return second.output as z.infer<S>;
}

function hasEmptyText(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() === '';
  if (value && typeof value === 'object')
    return Object.values(value).some(hasEmptyText);
  return false;
}

function assemble(
  s: MysteryCaseSkeleton,
  spec: MysteryArchetypeSpec,
  o: Outline,
  places: z.infer<ReturnType<(typeof TEXT_PARTS)['places']['schema']>>,
  evidence: z.infer<ReturnType<(typeof TEXT_PARTS)['evidence']['schema']>>,
  people: z.infer<ReturnType<(typeof TEXT_PARTS)['people']['schema']>>,
): MysteryCaseFile {
  const c = s.caseFile;
  const room = places.rooms as Record<
    string,
    { description: string; brief: string; lockedText?: string }
  >;
  const lie = clip(o.canon.lie ?? '', 80).replace(/[“”"]/g, '');
  // 机关提示与主禁制次序选项由程序按规则渲染，避免模型写出互相矛盾的提示。
  const partLabel = (id: string) => clip(o.parts?.[id] ?? '', 8);
  const hintText = new Map(
    (c.mechanisms ?? []).flatMap((m) =>
      m.hints.map(
        (h) => [h.clueId, renderHintRule(h.rule, partLabel)] as const,
      ),
    ),
  );
  const mech = (places.mechanisms ?? {}) as Record<
    string,
    { solvedText: string; backlashText: string }
  >;
  const guard = places.guards as Record<
    string,
    { description: string; bypassText: string }
  >;
  const event = places.events as Record<
    string,
    { warning: string; text: string }
  >;
  return {
    ...c,
    title: clip(o.title, 24),
    truth: clip(o.truth, 600),
    brief: {
      identity: clip(o.brief.identity, 120),
      goal: clip(o.brief.goal, 120),
      opening: clip(o.brief.opening, 400),
      relations: c.brief.relations.map((r) => ({
        npcId: r.npcId,
        text: clip(o.npcs[r.npcId]?.relation ?? '', 80),
      })),
    },
    rooms: c.rooms.map((r) => ({
      ...r,
      name: clip(o.rooms[r.id] ?? '', 16),
      description: clip(room[r.id]?.description ?? '', 240),
      brief: clip(room[r.id]?.brief ?? '', 60),
      ...(r.requires
        ? { lockedText: clip(room[r.id]?.lockedText ?? '', 80) }
        : {}),
    })),
    objects: c.objects.map((x) => ({
      ...x,
      name: clip(o.objects[x.id] ?? '', 16),
      detail: clip(str(places.objects, x.id), 220),
    })),
    clues: c.clues.map((x) => ({
      ...x,
      name: clip(o.clues[x.id]?.name ?? '', 16),
      // 凶手的说法只有一个出处，线索与台词逐字一致。
      text:
        x.id === CLAIM_CLUE
          ? clip(`${o.npcs[spec.liar]?.name ?? ''}自称：“${lie}”`, 160)
          : hintText.has(x.id)
            ? clip(
                `${clip(str(evidence.clues, x.id), 100)}：“${hintText.get(x.id)}”`,
                160,
              )
            : clip(str(evidence.clues, x.id), 160),
    })),
    items: c.items.map((x) => ({
      ...x,
      name: clip(o.items[x.id] ?? '', 16),
      text: clip(str(evidence.items, x.id), 120),
    })),
    npcs: c.npcs.map((n) => {
      const lines = (
        people.npcs as Record<
          string,
          { greeting: string; idleLine: string; deflectLine: string }
        >
      )[n.id];
      return {
        ...n,
        name: clip(o.npcs[n.id]?.name ?? '', 12),
        title: clip(o.npcs[n.id]?.title ?? '', 16),
        greeting: clip(lines?.greeting ?? '', 200),
        idleLine: clip(lines?.idleLine ?? '', 120),
        deflectLine: clip(lines?.deflectLine ?? '', 120),
        secrets: n.secrets.map((x) => {
          const line = str(people.secrets, `${n.id}:${x.clueId}`);
          return {
            ...x,
            line:
              x.clueId === CLAIM_CLUE
                ? clip(`${clip(line, 60)}“${lie}”`, 220)
                : hintText.has(x.clueId)
                  ? clip(`${clip(line, 120)}“${hintText.get(x.clueId)}”`, 220)
                  : clip(line, 220),
          };
        }),
        reactions: n.reactions.map((x) => ({
          ...x,
          line: clip(str(people.reactions, x.id), 220),
        })),
      };
    }),
    interactions: c.interactions.map((x) => ({
      ...x,
      text: clip(str(evidence.interactions, x.id), 220),
    })),
    questions: c.questions.map((q) => ({
      ...q,
      ...(q.options
        ? {
            options: q.options.map((x) => ({
              ...x,
              label: s.sequences?.[x.id]
                ? s.sequences[x.id]!.map(partLabel).join('→')
                : clip(str(o.options, x.id), 30),
            })),
          }
        : {}),
      explanation: clip(str(evidence.explanations, q.id), 200),
    })),
    ...(c.mechanisms
      ? {
          mechanisms: c.mechanisms.map((m) => ({
            ...m,
            name: clip(o.mechanisms?.[m.id] ?? '', 12),
            parts: m.parts.map((x) => ({ ...x, label: partLabel(x.id) })),
            // 主禁制在结案时作答，没有开启与反噬的现场描写。
            solvedText: m.final
              ? '主禁制应声而开。'
              : clip(mech[m.id]?.solvedText ?? '', 200),
            backlashText: m.final
              ? '主禁制纹丝不动。'
              : clip(mech[m.id]?.backlashText ?? '', 160),
          })),
        }
      : {}),
    ...(c.events
      ? {
          events: c.events.map((e) => ({
            ...e,
            warning: clip(event[e.id]?.warning ?? '', 160),
            text: clip(event[e.id]?.text ?? '', 200),
          })),
        }
      : {}),
    ...(c.guards
      ? {
          guards: c.guards.map((g) => ({
            ...g,
            name: clip(o.guards[g.id] ?? '', 12),
            description: clip(guard[g.id]?.description ?? '', 200),
            bypassText: clip(guard[g.id]?.bypassText ?? '', 200),
          })),
        }
      : {}),
  };
}

export interface MysteryCaseRequest {
  template: MysteryScenarioTemplate;
  seed: number;
  node: Pick<
    SatelliteNode,
    'name' | 'realm_requirement' | 'tags' | 'description'
  >;
  setting: DungeonScenarioConfig;
  /** 开局的节点：生成失败时只能退回绑定到此节点的保底案卷。 */
  mapNodeId: string;
}

/** 修仙题材常见姓氏。模型偏爱沈、柳、赵、陆等少数几个，按种子给出一组以拉开各案的人名。 */
const SURNAMES =
  '韩厉墨萧凌白秦楚叶云林方顾温卫钟岳唐聂殷孟葛褚晏贺奚宁严戚商闻俞霍邵乔谭苗蔺甘晁鲁骆'.split(
    '',
  );

function namingPalette(seed: number) {
  let x = seed >>> 0 || 1;
  const pool = [...SURNAMES];
  const surnames: string[] = [];
  while (surnames.length < 8) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    surnames.push(pool.splice(x % pool.length, 1)[0]!);
  }
  return {
    surnames,
    avoid:
      '不用沈、柳、赵、陆、苏、李、王、张作姓，不用“清秋”“铁山”“三娘”这类常见名',
  };
}

/** 骨架或生成流水线不兼容地变化时递增，剧本库可据此整批停用旧本。 */
export const MYSTERY_GENERATOR_VERSION = 4;

export interface GeneratedMysteryCase {
  caseFile: MysteryCaseFile;
  source: 'generated' | 'fallback';
  /** 审校修正的问题数，仅生成成功时有意义。 */
  reviewIssueCount: number;
}

/**
 * 三段式生成：程序按种子生成可解骨架 → LLM 起名并写真相 → 三段正文并行填写。
 * 所有引用由骨架固定，LLM 只写文字；任一段失败时，只在节点绑定了保底案卷时退回保底，否则抛错。
 */
export async function generateMysteryCase(
  request: MysteryCaseRequest,
): Promise<GeneratedMysteryCase> {
  // 剧本全服共享，不带任何玩家个人信息，角色本只用第二人称“你”。
  const { template, node, setting } = request;
  let reviewIssueCount = 0;
  try {
    const spec = archetypeOf(template);
    const skeleton = buildMysterySkeleton(template, request.seed);
    const draftOutline = () =>
      callStage({
        promptId: 'dungeon-case',
        sceneId: 'dungeon-case',
        name: 'DungeonMysteryOutline',
        schema: outlineSchema(skeleton, spec),
        context: {
          archetype: { rules: spec.rules },
          naming: namingPalette(request.seed),
          template: {
            name: template.name,
            summary: template.summary,
            roles: template.roles.map((r) => ({
              slot: r.slot,
              label: r.label,
              guidance: r.guidance,
            })),
            writing_guidance: template.writing_guidance,
          },
          // 节点的结构化设定：房间、人物、往事与物件都从这里取材。
          setting: {
            name: node.name,
            realm: node.realm_requirement,
            tags: node.tags,
            description: node.description,
            overview: setting.setting,
            places: setting.places,
            inhabitants: setting.inhabitants,
            history: setting.history,
            objects: setting.objects,
            factions: setting.factions,
            forbidden: setting.forbidden,
          },
          structure: {
            rooms: skeleton.caseFile.rooms.map((r) => ({
              id: r.id,
              purpose: skeleton.purposes[r.id],
              exits: r.exits,
            })),
            npcs: skeleton.caseFile.npcs.map((n) => ({
              id: n.id,
              role: n.role,
              room: n.roomId,
            })),
            guards: (skeleton.caseFile.guards ?? []).map((g) => ({
              id: g.id,
              room: g.roomId,
              purpose: skeleton.purposes[g.id],
            })),
            answers: skeleton.caseFile.questions,
          },
        },
      });
    // 真相必须用定下的名字提到关键人物，否则后续正文会各说各话；不符则重写一次大纲。
    const truthMissesCast = (o: Outline) =>
      spec.cast.some((id) => !o.truth.includes(o.npcs[id]?.name ?? '\u0000'));
    let outline = await draftOutline();
    if (truthMissesCast(outline)) outline = await draftOutline();
    if (truthMissesCast(outline)) throw new Error('真相与人物名字不一致');
    const structure = structureContext(skeleton, outline, spec);
    const part = <S extends z.ZodType>(key: TextPart, schema: S) =>
      callStage({
        promptId: 'dungeon-case-text',
        sceneId: 'dungeon-case-text',
        name: `DungeonMysteryText_${key}`,
        schema,
        context: {
          part: key,
          task: TEXT_PARTS[key].task,
          writing_guidance: template.writing_guidance,
          setting: setting.setting,
          forbidden: setting.forbidden,
          case: structure,
        },
      });
    // 三段互不依赖，并行生成以缩短开局等待。
    const [places, evidence, people] = await Promise.all([
      part('places', TEXT_PARTS.places.schema(skeleton)),
      part('evidence', TEXT_PARTS.evidence.schema(skeleton)),
      part('people', TEXT_PARTS.people.schema(skeleton)),
    ]);
    const draft = MysteryCaseFileSchema.safeParse(
      assemble(skeleton, spec, outline, places, evidence, people),
    );
    if (!draft.success)
      throw new Error(
        `初稿结构无效：${draft.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.')} ${i.message}`)
          .join('；')}`,
      );
    const drafted = draft.data;
    // 分头撰写的正文最后统一对照事实设定审校，只改写有矛盾的字段。
    // 改写可能引入新的不一致，有修正时再审一轮，最多两轮。
    let reviewed = drafted;
    for (let round = 1; round <= 2; round++) {
      const result = await reviewMysteryCase(reviewed, outline.canon, {
        locked: [
          ...LOCKED_FIELDS,
          ...(drafted.mechanisms ?? []).flatMap((m) =>
            m.hints.flatMap((h) => [
              `clues.${h.clueId}.text`,
              ...drafted.npcs.flatMap((n) =>
                n.secrets.some((x) => x.clueId === h.clueId)
                  ? [`secrets.${n.id}:${h.clueId}`]
                  : [],
              ),
            ]),
          ),
          ...Object.keys(skeleton.sequences ?? {}).flatMap((id) =>
            drafted.questions.flatMap((q) =>
              q.options?.some((x) => x.id === id)
                ? [`options.${q.id}.${id}`]
                : [],
            ),
          ),
        ],
      }).catch((error: unknown) => {
        console.warn('[DungeonMystery] 一致性审校失败，沿用当前稿:', error);
        return { caseFile: reviewed, issues: [] };
      });
      reviewed = result.caseFile;
      reviewIssueCount += result.issues.length;
      if (result.issues.length === 0) break;
      console.info(`[DungeonMystery] 第 ${round} 轮审校修正:`, result.issues);
    }
    const parsed = MysteryCaseFileSchema.safeParse(reviewed);
    const issues = parsed.success
      ? validateMysteryCase(parsed.data, template)
      : parsed.error.issues
          .slice(0, 8)
          .map((i) => `${i.path.join('.')}: ${i.message}`);
    if (parsed.success && issues.length === 0)
      return { caseFile: parsed.data, source: 'generated', reviewIssueCount };
    console.warn('[DungeonMystery] 案卷组装未通过校验，改用保底案卷:', issues);
  } catch (error) {
    console.warn('[DungeonMystery] 案卷生成失败，改用保底案卷:', error);
  }
  const fallback = getMysteryFallbackCase(template.id, request.mapNodeId);
  if (!fallback) throw new Error('案卷生成失败，此地没有可用的保底案卷');
  return { caseFile: fallback, source: 'fallback', reviewIssueCount: 0 };
}
