import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TYPE_DESCRIPTIONS } from '@shared/engine/material/creation/config';
import { buildDungeonRoundLlmContext, buildDungeonSettlementLlmContext } from '../src/server/lib/dungeon/llmContext';
import {
  DungeonRoundLlmSchema,
  DungeonRoundSchema,
  DungeonSettlementLlmSchema,
  DungeonSettlementSchema,
  type DungeonState,
} from '../src/server/lib/dungeon/types';
import { stableCompactStringify } from '../src/server/utils/llmPayload';

type PromptSections = {
  system: string;
  user: string;
};

function loadPromptSections(id: string): PromptSections {
  const promptPath = path.join(process.cwd(), 'src/server/prompts', `${id}.md`);
  const raw = readFileSync(promptPath, 'utf8').replace(/\r\n/g, '\n');
  const result: PromptSections = {
    system: '',
    user: '',
  };

  const sectionPattern = /^##\s+(system|user)\s*$/gim;
  const matches = [...raw.matchAll(sectionPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const key = match[1]?.toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]?.index ?? raw.length) : raw.length;
    const content = raw.slice(start, end).trim();
    if (key === 'system') {
      result.system = content;
    }
    if (key === 'user') {
      result.user = content;
    }
  }

  return result;
}

function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');
}

function buildDungeonMaterialTypeTable(): string {
  return Object.entries(TYPE_DESCRIPTIONS)
    .map(([key, desc]) => `| ${key} | ${desc} |`)
    .join('\n');
}

function buildSampleDungeonState(): DungeonState {
  return {
    cultivatorId: 'cultivator-sample',
    mapNodeId: 'map-sample',
    theme: '玄阴洞府',
    currentRound: 3,
    maxRounds: 5,
    history: [
      {
        round: 1,
        scene: '你潜入废弃洞府外层，石阶阴冷，隐有水汽自裂缝溢出。',
        choice: '绕过正门，从侧洞入内',
        outcome: '避开巡游阴魂，顺利进入外围药圃。',
        gained_items: ['寒露草'],
      },
      {
        round: 2,
        scene: '药圃内残阵未散，地面隐有暗蓝灵纹，稍踏便有寒意上冲。',
        choice: '强行破阵',
        outcome: '历经苦战，你斩灭阵中阴灵，勉强保住心脉。',
        gained_items: ['阴纹碎玉'],
      },
      {
        round: 3,
        scene: '破阵后，内殿石门半开，门缝中隐现古旧丹炉与一角玉简。',
        gained_items: ['残缺玉简'],
      },
    ],
    status: 'EXPLORING',
    dangerScore: 58,
    isFinished: false,
    playerInfo: {
      name: '林秋',
      realm: '金丹 中期',
      gender: '男',
      age: 27,
      lifespan: 168,
      personality: '谨慎果决',
      attributes: {
        vitality: 80,
        spirit: 88,
        wisdom: 72,
        speed: 66,
        willpower: 78,
      },
      spiritual_roots: ['水灵根', '木灵根'],
      fates: ['孤星照命（逢险常伴机缘）'],
      skills: ['寒潮御剑诀', '青木养元术'],
      spirit_stones: 1200,
      background: '边荒散修，善于在险地中求生。',
      inventory_summary: '若干疗伤丹与旧法器',
      resourceCaps: {
        maxHp: 1200,
        maxMp: 900,
      },
    },
    currentOptions: [],
    location: {
      location: '玄阴洞府',
      location_tags: ['阴泉', '残阵', '药圃', '内殿'],
      location_description: '古洞深处阴泉未绝，残阵与旧药圃交错，稍有不慎便会牵动煞气与封禁。',
    },
    summary_of_sacrifice: [
      {
        type: 'hp_loss',
        value: 0.14,
        desc: '寒煞侵体',
      },
      {
        type: 'material',
        value: 1,
        required_type: 'herb',
        required_quality: '灵品',
      },
    ],
    realGains: [],
    accumulatedRewards: [
      {
        name: '寒露草',
        description: '叶尖凝着细寒灵露，可清心护脉。',
        material_type: 'herb',
        element: '水',
        reward_score: 42,
      },
      {
        name: '残缺玉简',
        description: '玉简残篇记着半套御寒法门。',
        material_type: 'gongfa_manual',
        reward_score: 61,
      },
    ],
    currentRoundItems: [],
    accumulatedHpLoss: 0.14,
    accumulatedMpLoss: 0.22,
    condition: {
      statuses: [
        {
          key: 'weakness',
          source: 'event',
          stacks: 1,
        },
      ],
    } as DungeonState['condition'],
  };
}

function reportStructuredScene(args: {
  sceneId: string;
  system: string;
  user: string;
  businessSchema: { toJSONSchema: () => unknown };
  llmSchema: { toJSONSchema: () => unknown };
}): void {
  const businessSchemaChars = stableCompactStringify(
    args.businessSchema.toJSONSchema(),
  ).length;
  const llmSchemaChars = stableCompactStringify(args.llmSchema.toJSONSchema()).length;

  console.log(
    [
      args.sceneId,
      `system=${args.system.length}`,
      `user=${args.user.length}`,
      `schema=${llmSchemaChars}`,
      `runtimeSchema=${businessSchemaChars}`,
    ].join(' '),
  );
}

const materialTypeTable = buildDungeonMaterialTypeTable();
const roundPrompt = loadPromptSections('dungeon-round');
const settlementPrompt = loadPromptSections('dungeon-settlement');
const sampleState = buildSampleDungeonState();
const roundContext = buildDungeonRoundLlmContext({
  state: sampleState,
  mapRealm: '金丹',
  realmGap: 0,
  phase: '变局期：引入转折，开始消耗资源。',
});
const settlementContext = buildDungeonSettlementLlmContext({
  state: sampleState,
  mapRealm: '金丹',
  endDisposition: 'completed',
});
const roundSystem =
  renderTemplate(roundPrompt.system, {
    materialTypeTable,
  }) +
  `\n\n### 成本(costs)规范:
- **必须使用指定类型**: spirit_stones, lifespan, cultivation_exp, comprehension_insight, material, hp_loss, mp_loss, weak, battle, artifact_damage。
- **数值范围**: hp_loss, mp_loss 必须是 0-1 之间的小数；其他类型为正整数。
- **材料(material)**: 禁止指定 name，必须提供 required_type 和 required_quality。
- **冲突禁止**: 若有 'battle'，严禁同时出现 'hp_loss' 或 'mp_loss'。
- **战斗元数据(battle.metadata)**: 必须提供 race 与 realm_stage；可选提供 enemy_name、background、description、is_boss。`;
const roundUser = renderTemplate(roundPrompt.user, {
  userContextJson: stableCompactStringify(roundContext),
});
const settlementSystem = renderTemplate(settlementPrompt.system, {
  materialTypeTable,
});
const settlementUser = renderTemplate(settlementPrompt.user, {
  settlementContextJson: stableCompactStringify(settlementContext),
});

console.log('# LLM cost report');
reportStructuredScene({
  sceneId: 'dungeon-round',
  system: roundSystem,
  user: roundUser,
  businessSchema: DungeonRoundSchema,
  llmSchema: DungeonRoundLlmSchema,
});
reportStructuredScene({
  sceneId: 'dungeon-settlement',
  system: settlementSystem,
  user: settlementUser,
  businessSchema: DungeonSettlementSchema,
  llmSchema: DungeonSettlementLlmSchema,
});
