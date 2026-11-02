import { getMysteryFallbackCase } from '@daoyou/game-content/dungeon/scenarios';
import {
  MysteryCaseFileSchema,
  type MysteryCaseFile,
  type MysteryCondition,
  type MysteryEffect,
  type MysteryScenarioTemplate,
} from '@daoyou/game-domain/dungeon/mystery';
import type { SatelliteNode } from '@daoyou/game-domain/world/map';
import { validateMysteryCase } from '@daoyou/game-rules/dungeon/mystery';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import {
  stableCompactStringify,
  truncateText,
} from '@server/utils/llmPayload.js';
import { z } from 'zod';
import type { PlayerInfo } from '../flow/types.js';

const CASE_TIMEOUT_MS = 100_000;
/** 首次生成在此时间内失败才做一次修正重试，避免超出命令锁时长。 */
const REPAIR_WINDOW_MS = 60_000;

const LlmCondition = z
  .array(
    z.object({
      type: z.enum(['has_clue', 'has_item', 'flag', 'visited']),
      id: z.string(),
    }),
  )
  .max(4)
  .describe('全部满足才成立；无条件填空数组');

const LlmEffect = z.object({
  kind: z.enum(['reveal_clue', 'grant_item', 'consume_item', 'set_flag']),
  id: z.string().describe('线索、物品或标记 id'),
});

const LlmCaseSchema = z.object({
  title: z.string().describe('案卷标题，2–12 字'),
  truth: z.string().describe('完整真相，玩家结案后可见，600 字以内'),
  brief: z.object({
    identity: z.string().describe('玩家身份，120 字以内'),
    goal: z.string().describe('此行目的，120 字以内'),
    opening: z.string().describe('开场一幕，400 字以内'),
    relations: z.array(z.object({ npcId: z.string(), text: z.string() })),
  }),
  startRoomId: z.string(),
  rooms: z.array(
    z.object({
      id: z.string(),
      name: z.string().describe('16 字以内'),
      description: z.string().describe('初次进入的描写，240 字以内'),
      brief: z.string().describe('再次进入的一句话，60 字以内'),
      exits: z.array(z.string()),
      requires: LlmCondition,
      lockedText: z.string().describe('有进入条件时的受阻描写；否则为空字符串'),
    }),
  ),
  objects: z.array(
    z.object({
      id: z.string(),
      roomId: z.string(),
      name: z.string().describe('16 字以内'),
      detail: z.string().describe('细看后的描写，220 字以内'),
    }),
  ),
  clues: z.array(
    z.object({
      id: z.string(),
      name: z.string().describe('16 字以内'),
      text: z.string().describe('线索事实，160 字以内'),
      key: z.boolean(),
      supports: z.array(z.string()).describe('支撑的结案问题 id'),
      foundAtObjectId: z.string().describe('搜查获得的物件 id；否则为空字符串'),
      foundAtRequires: LlmCondition,
    }),
  ),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string().describe('16 字以内'),
      text: z.string().describe('120 字以内'),
      initial: z.boolean(),
      foundAtObjectId: z.string().describe('搜查获得的物件 id；否则为空字符串'),
      foundAtRequires: LlmCondition,
    }),
  ),
  npcs: z.array(
    z.object({
      id: z.string(),
      name: z.string().describe('12 字以内'),
      title: z.string().describe('16 字以内'),
      role: z.string().describe('模板身份 slot'),
      roomId: z.string(),
      greeting: z.string().describe('初见台词，200 字以内'),
      idleLine: z.string().describe('120 字以内'),
      deflectLine: z.string().describe('120 字以内'),
      secrets: z.array(
        z.object({
          clueId: z.string(),
          requires: LlmCondition,
          line: z.string().describe('220 字以内'),
        }),
      ),
      reactions: z.array(
        z.object({
          id: z.string(),
          evidenceId: z.string(),
          line: z.string().describe('220 字以内'),
          effects: z.array(LlmEffect),
          exposesLie: z.boolean(),
        }),
      ),
    }),
  ),
  interactions: z.array(
    z.object({
      id: z.string(),
      itemId: z.string(),
      targetId: z.string(),
      requires: LlmCondition,
      text: z.string().describe('220 字以内'),
      effects: z.array(LlmEffect),
    }),
  ),
  questions: z.array(
    z.object({
      id: z.string(),
      options: z.array(z.object({ id: z.string(), label: z.string() })),
      answer: z.string(),
      explanation: z.string().describe('200 字以内'),
    }),
  ),
});

type LlmCase = z.infer<typeof LlmCaseSchema>;

/** 同一输入始终映射到同一 id，引用关系因此保持一致。 */
function normalizeId(raw: string): string {
  const id = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return id || 'x';
}

function toCondition(
  list: LlmCase['rooms'][number]['requires'],
): MysteryCondition | undefined {
  const parts: MysteryCondition[] = list.map((c) => {
    const id = normalizeId(c.id);
    switch (c.type) {
      case 'has_clue':
        return { has_clue: id };
      case 'has_item':
        return { has_item: id };
      case 'flag':
        return { flag: id };
      case 'visited':
        return { visited: id };
    }
  });
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : { all: parts };
}

function toEffects(list: LlmCase['interactions'][number]['effects']) {
  return list.map((e): MysteryEffect => {
    const id = normalizeId(e.id);
    switch (e.kind) {
      case 'reveal_clue':
        return { kind: 'reveal_clue', clueId: id };
      case 'grant_item':
        return { kind: 'grant_item', itemId: id };
      case 'consume_item':
        return { kind: 'consume_item', itemId: id };
      case 'set_flag':
        return { kind: 'set_flag', flag: id };
    }
  });
}

function foundAt(objectId: string, requires: LlmCase['rooms'][number]['requires']) {
  if (!objectId.trim()) return undefined;
  const condition = toCondition(requires);
  return {
    objectId: normalizeId(objectId),
    ...(condition ? { requires: condition } : {}),
  };
}

function toCaseFile(raw: LlmCase, template: MysteryScenarioTemplate) {
  const kinds = new Map(template.questions.map((q) => [q.id, q.answer_kind]));
  return MysteryCaseFileSchema.safeParse({
    templateId: template.id,
    title: raw.title,
    truth: raw.truth,
    brief: {
      ...raw.brief,
      relations: raw.brief.relations.map((r) => ({
        npcId: normalizeId(r.npcId),
        text: r.text,
      })),
    },
    startRoomId: normalizeId(raw.startRoomId),
    rooms: raw.rooms.map((r) => {
      const requires = toCondition(r.requires);
      return {
        id: normalizeId(r.id),
        name: r.name,
        description: r.description,
        brief: r.brief,
        exits: r.exits.map(normalizeId),
        ...(requires ? { requires } : {}),
        ...(r.lockedText.trim() ? { lockedText: r.lockedText } : {}),
      };
    }),
    objects: raw.objects.map((o) => ({
      ...o,
      id: normalizeId(o.id),
      roomId: normalizeId(o.roomId),
    })),
    clues: raw.clues.map((c) => {
      const at = foundAt(c.foundAtObjectId, c.foundAtRequires);
      return {
        id: normalizeId(c.id),
        name: c.name,
        text: c.text,
        key: c.key,
        supports: c.supports.map(normalizeId),
        ...(at ? { foundAt: at } : {}),
      };
    }),
    items: raw.items.map((i) => {
      const at = foundAt(i.foundAtObjectId, i.foundAtRequires);
      return {
        id: normalizeId(i.id),
        name: i.name,
        text: i.text,
        ...(i.initial ? { initial: true } : {}),
        ...(at ? { foundAt: at } : {}),
      };
    }),
    npcs: raw.npcs.map((n) => ({
      ...n,
      id: normalizeId(n.id),
      role: normalizeId(n.role),
      roomId: normalizeId(n.roomId),
      // 秘密漏写条件时视为“到场交谈即可得知”，避免整份案卷因此作废。
      secrets: n.secrets.map((s) => ({
        clueId: normalizeId(s.clueId),
        requires: toCondition(s.requires) ?? { visited: normalizeId(n.roomId) },
        line: s.line,
      })),
      reactions: n.reactions.map((r) => ({
        id: normalizeId(r.id),
        evidenceId: normalizeId(r.evidenceId),
        line: r.line,
        effects: toEffects(r.effects),
        exposesLie: r.exposesLie,
      })),
    })),
    // 没有效果的交互对玩家只是“毫无反应”，直接丢弃。
    interactions: raw.interactions
      .filter((i) => i.effects.length > 0)
      .map((i) => {
      const requires = toCondition(i.requires);
      return {
        id: normalizeId(i.id),
        itemId: normalizeId(i.itemId),
        targetId: normalizeId(i.targetId),
        ...(requires ? { requires } : {}),
        text: i.text,
        effects: toEffects(i.effects),
      };
    }),
    questions: raw.questions.map((q) => {
      const id = normalizeId(q.id);
      return {
        id,
        ...(kinds.get(id) === 'choice'
          ? {
              options: q.options.map((o) => ({
                id: normalizeId(o.id),
                label: o.label,
              })),
            }
          : {}),
        answer: normalizeId(q.answer),
        explanation: q.explanation,
      };
    }),
  });
}

export interface MysteryCaseRequest {
  template: MysteryScenarioTemplate;
  node: Pick<SatelliteNode, 'name' | 'realm_requirement' | 'tags' | 'description'>;
  setting: { setting: string; factions?: string[]; forbidden?: string[] };
  player: Pick<PlayerInfo, 'realm' | 'gender' | 'personality' | 'background'>;
}

async function attempt(
  request: MysteryCaseRequest,
  previousIssues?: string[],
): Promise<{ caseFile?: MysteryCaseFile; issues: string[] }> {
  const { template, node, setting, player } = request;
  const prompt = renderPrompt('dungeon-case', {
    userContextJson: stableCompactStringify({
      template,
      setting: {
        name: node.name,
        realm: node.realm_requirement,
        tags: node.tags,
        description: node.description,
        ...setting,
      },
      player: {
        realm: player.realm,
        gender: player.gender,
        personality: truncateText(player.personality, 20),
        background: truncateText(player.background, 80),
      },
      ...(previousIssues?.length
        ? { previousIssues: previousIssues.slice(0, 12) }
        : {}),
    }),
  });
  const result = await generateAiObject({
    system: prompt.system,
    prompt: prompt.user,
    schema: LlmCaseSchema,
    name: 'DungeonMysteryCase',
    sceneId: 'dungeon-case',
    timeoutMs: CASE_TIMEOUT_MS,
  });
  const parsed = toCaseFile(result.output, template);
  if (!parsed.success) {
    return {
      issues: parsed.error.issues
        .slice(0, 12)
        .map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }
  const issues = validateMysteryCase(parsed.data, template);
  return issues.length ? { issues } : { caseFile: parsed.data, issues };
}

/**
 * 生成并校验案卷。LLM 失败或校验不通过时改用模板的手写保底案卷，
 * 保证开局不会因生成质量而失败。
 */
export async function generateMysteryCase(
  request: MysteryCaseRequest,
): Promise<{ caseFile: MysteryCaseFile; source: 'generated' | 'fallback' }> {
  const startedAt = Date.now();
  try {
    let result = await attempt(request);
    if (!result.caseFile && Date.now() - startedAt < REPAIR_WINDOW_MS) {
      console.warn('[DungeonMystery] 案卷校验未通过，重试一次:', result.issues);
      result = await attempt(request, result.issues);
    }
    if (result.caseFile) return { caseFile: result.caseFile, source: 'generated' };
    console.warn('[DungeonMystery] 案卷校验未通过，改用保底案卷:', result.issues);
  } catch (error) {
    console.warn('[DungeonMystery] 案卷生成失败，改用保底案卷:', error);
  }
  const fallback = getMysteryFallbackCase(request.template.id);
  if (!fallback) throw new Error('剧本缺少保底案卷');
  return { caseFile: fallback, source: 'fallback' };
}
