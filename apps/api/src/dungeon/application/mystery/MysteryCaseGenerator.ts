import { getMysteryFallbackCase } from '@daoyou/game-content/dungeon/scenarios';
import {
  MysteryCaseFileSchema,
  type MysteryCaseFile,
  type MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import type { SatelliteNode } from '@daoyou/game-domain/world/map';
import {
  buildMysterySkeleton,
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

/** whodunit 骨架约定：凶手与其谎言线索的 id。 */
const CULPRIT = 'npc_culprit';
const HEIR = 'npc_heir';
const CLAIM_CLUE = 'clue_claim';
/** 由程序渲染、审校时不允许改写的字段。 */
const LOCKED_FIELDS = [`clues.${CLAIM_CLUE}.text`];

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
  };
}

function outlineSchema(skeleton: MysteryCaseSkeleton) {
  const id = ids(skeleton);
  const p = skeleton.purposes;
  const name = (limit: number) => (key: string) =>
    Text(limit, `名称；作用：${p[key]}`);
  // 字段顺序即生成顺序：先定名字与事实，最后写真相，真相才能与名字一致。
  return z.object({
    npcs: keyed(id.npcs, (key) =>
      z.object({
        name: Text(6, `人物在全案中唯一使用的名字；作用：${p[key]}`),
        title: Text(
          8,
          '对外身份称谓；凶手的称谓即其对外宣称的身份，全案提到时都用这个称谓',
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
    clues: keyed(id.clues, (key) =>
      z.object({
        name: Text(8, `线索名称；作用：${p[key]}`),
        fact: Text(50, '这条线索揭示的核心事实，一句话，后续正文必须与之一致'),
      }),
    ),
    canon: z.object({
      victim: Text(40, '洞府主人的名字、身份与表面死因'),
      culprit: Text(60, '凶手的真名、伪装身份与动机'),
      method: Text(60, '作案手段：用了什么东西、怎样下手、留下什么痕迹'),
      lie: Text(
        50,
        '凶手对外宣称来历的原话，一两句，不加引号；与其称谓 title 一致',
      ),
      contradiction: Text(60, 'clue_record 记载的哪条事实与 lie 矛盾'),
      token: Text(40, '传人的祖传信物是什么样子；其纹样与密室门上的印记相同'),
    }),
    title: Text(12, '案卷标题'),
    truth: Text(
      500,
      '完整真相：只用上面定下的名字，与 canon 和各线索 fact 一致',
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
    task: '为每个房间写初次进入的描写与再次进入的一句话；有进入条件的房间写受阻描写；为每个物件写细看后的描写。房间描写只写空间、光线、气味与在场人物的姿态，不描写任何物件的细节（物件会单独列出）。物件分两种：藏有线索或可被探查的物件只写一句引人注意的异样，不写具体发现，具体发现由线索正文呈现；其余物件可以细写陈设。',
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
    task: '提到任何人物的对外身份时只用其 title，不另起说法；为每个人物写初见台词、无话可说时的台词、被出示无关证据时的台词，言行符合其 nature（不能言语者只写动作）；为每条秘密写说出时的台词，内容与对应线索的 fact 一致；凶手说谎的那条秘密只写说话前的神态动作，原话由程序补上；为每个反应写被出示证据时的言行，只提证据名称，不重新描写证据细节。人物只知道自己 nature 与 truth 中该知道的事，不说破玩家尚未发现的线索；凶手的初见台词只谈来意，不谈来历。',
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
function structureContext(s: MysteryCaseSkeleton, o: Outline) {
  const c = s.caseFile;
  const nameOf = (id: string) =>
    o.rooms[id] ??
    o.objects[id] ??
    o.clues[id]?.name ??
    o.items[id] ??
    o.npcs[id]?.name ??
    id;
  return {
    title: o.title,
    truth: o.truth,
    canon: o.canon,
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
    answers: c.questions.map((q) => ({ id: q.id, answer: nameOf(q.answer) })),
  };
}

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
  // 结构已经固定，失败只可能是网络或输出截断，单段重试一次即可。
  const result = await run().catch(() => run());
  return result.output as z.infer<S>;
}

function assemble(
  s: MysteryCaseSkeleton,
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
  const str = (record: Record<string, unknown>, key: string) =>
    String(record[key] ?? '');
  const lie = clip(o.canon.lie, 80).replace(/[“”"]/g, '');
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
          ? clip(`${o.npcs[CULPRIT]?.name ?? ''}自称：“${lie}”`, 160)
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
      explanation: clip(str(evidence.explanations, q.id), 200),
    })),
  };
}

export interface MysteryCaseRequest {
  template: MysteryScenarioTemplate;
  seed: number;
  node: Pick<
    SatelliteNode,
    'name' | 'realm_requirement' | 'tags' | 'description'
  >;
  setting: { setting: string; factions?: string[]; forbidden?: string[] };
}

/** 骨架或生成流水线不兼容地变化时递增，剧本库可据此整批停用旧本。 */
export const MYSTERY_GENERATOR_VERSION = 1;

export interface GeneratedMysteryCase {
  caseFile: MysteryCaseFile;
  source: 'generated' | 'fallback';
  /** 审校修正的问题数，仅生成成功时有意义。 */
  reviewIssueCount: number;
}

/**
 * 三段式生成：程序按种子生成可解骨架 → LLM 起名并写真相 → 三段正文并行填写。
 * 所有引用由骨架固定，LLM 只写文字；任一段失败则使用模板的手写保底案卷。
 */
export async function generateMysteryCase(
  request: MysteryCaseRequest,
): Promise<GeneratedMysteryCase> {
  // 剧本全服共享，不带任何玩家个人信息，角色本只用第二人称“你”。
  const { template, node, setting } = request;
  let reviewIssueCount = 0;
  try {
    const skeleton = buildMysterySkeleton(template, request.seed);
    const draftOutline = () =>
      callStage({
        promptId: 'dungeon-case',
        sceneId: 'dungeon-case',
        name: 'DungeonMysteryOutline',
        schema: outlineSchema(skeleton),
        context: {
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
          setting: {
            name: node.name,
            realm: node.realm_requirement,
            tags: node.tags,
            description: node.description,
            ...setting,
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
            answers: skeleton.caseFile.questions,
          },
        },
      });
    // 真相必须用定下的名字提到凶手与传人，否则后续正文会各说各话；不符则重写一次大纲。
    const truthMissesCast = (o: Outline) =>
      [CULPRIT, HEIR].some(
        (id) => !o.truth.includes(o.npcs[id]?.name ?? '\u0000'),
      );
    let outline = await draftOutline();
    if (truthMissesCast(outline)) outline = await draftOutline();
    if (truthMissesCast(outline)) throw new Error('真相与人物名字不一致');
    const structure = structureContext(skeleton, outline);
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
          forbidden: setting.forbidden ?? [],
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
      assemble(skeleton, outline, places, evidence, people),
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
        locked: LOCKED_FIELDS,
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
  const fallback = getMysteryFallbackCase(template.id);
  if (!fallback) throw new Error('剧本缺少保底案卷');
  return { caseFile: fallback, source: 'fallback', reviewIssueCount: 0 };
}
