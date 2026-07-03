import alchemyFormulaAnalysisPrompt from '@server/prompts/alchemy-formula-analysis.md?raw';
import alchemyImprovisedCopyPrompt from '@server/prompts/alchemy-improvised-copy.md?raw';
import alchemyRecipePlanPrompt from '@server/prompts/alchemy-recipe-plan.md?raw';
import battleReportPrompt from '@server/prompts/battle-report.md?raw';
import breakthroughStoryPrompt from '@server/prompts/breakthrough-story.md?raw';
import characterGenerationPrompt from '@server/prompts/character-generation.md?raw';
import divineFortunePrompt from '@server/prompts/divine-fortune.md?raw';
import dungeonRoundPrompt from '@server/prompts/dungeon-round.md?raw';
import dungeonSettlementPrompt from '@server/prompts/dungeon-settlement.md?raw';
import enemyNarrativePrompt from '@server/prompts/enemy-narrative.md?raw';
import fateNamingPrompt from '@server/prompts/fate-naming.md?raw';
import lifespanExhaustedPrompt from '@server/prompts/lifespan-exhausted.md?raw';
import materialGenerationPrompt from '@server/prompts/material-generation.md?raw';
import materialSemanticEnrichmentPrompt from '@server/prompts/material-semantic-enrichment.md?raw';
import productNamingPrompt from '@server/prompts/product-naming.md?raw';
import yieldStoryPrompt from '@server/prompts/yield-story.md?raw';
import { renderTemplate, type TemplateVariableMap } from '../template/render';

export interface PromptTemplateFile {
  id: string;
  system?: string;
  user?: string;
}

export interface RenderedPrompt {
  system: string;
  user: string;
}

export type PromptSectionKey = 'system' | 'user';

const bundledPromptSources: Record<string, string> = {
  'alchemy-formula-analysis.md': alchemyFormulaAnalysisPrompt,
  'alchemy-improvised-copy.md': alchemyImprovisedCopyPrompt,
  'alchemy-recipe-plan.md': alchemyRecipePlanPrompt,
  'battle-report.md': battleReportPrompt,
  'breakthrough-story.md': breakthroughStoryPrompt,
  'character-generation.md': characterGenerationPrompt,
  'divine-fortune.md': divineFortunePrompt,
  'dungeon-round.md': dungeonRoundPrompt,
  'dungeon-settlement.md': dungeonSettlementPrompt,
  'enemy-narrative.md': enemyNarrativePrompt,
  'fate-naming.md': fateNamingPrompt,
  'lifespan-exhausted.md': lifespanExhaustedPrompt,
  'material-generation.md': materialGenerationPrompt,
  'material-semantic-enrichment.md': materialSemanticEnrichmentPrompt,
  'product-naming.md': productNamingPrompt,
  'yield-story.md': yieldStoryPrompt,
};

export function parsePromptTemplateMarkdown(
  raw: string,
  source: string,
): PromptTemplateFile {
  const normalized = raw.replace(/\r\n/g, '\n');
  const idMatch = normalized.match(/^id:\s*(.+?)\s*$/m);

  if (!idMatch) {
    throw new Error(`Prompt 模板缺少 id 头: ${source}`);
  }

  const sections = new Map<string, string>();
  const sectionPattern = /^##\s+(system|user)\s*$/gim;
  const matches = [...normalized.matchAll(sectionPattern)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const key = match[1].toLowerCase();
    const start = (match.index ?? 0) + match[0].length;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1].index ?? raw.length)
        : raw.length;
    const content = normalized.slice(start, end).trim();
    sections.set(key, content);
  }

  return validatePromptTemplateFile(
    {
      id: idMatch[1].trim(),
      system: sections.get('system'),
      user: sections.get('user'),
    },
    source,
  );
}

function validatePromptTemplateFile(
  input: unknown,
  source: string,
): PromptTemplateFile {
  if (!input || typeof input !== 'object') {
    throw new Error(`Prompt 模板格式非法: ${source}`);
  }

  const record = input as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const system = typeof record.system === 'string' ? record.system : undefined;
  const user = typeof record.user === 'string' ? record.user : undefined;

  if (!id) {
    throw new Error(`Prompt 模板缺少有效 id: ${source}`);
  }
  if (system === undefined && user === undefined) {
    throw new Error(`Prompt 模板至少需要 system 或 user 之一: ${source}`);
  }

  return { id, system, user };
}

const promptTemplateMap = new Map<string, PromptTemplateFile>();

for (const [source, raw] of Object.entries(bundledPromptSources)) {
  const template = parsePromptTemplateMarkdown(raw, source);
  if (promptTemplateMap.has(template.id)) {
    throw new Error(`Prompt 模板 id 重复: ${template.id} (${source})`);
  }
  promptTemplateMap.set(template.id, template);
}

export function loadPromptTemplateFile(id: string): PromptTemplateFile {
  const template = promptTemplateMap.get(id);
  if (!template) {
    throw new Error(`Prompt 模板不存在: ${id}`);
  }
  return template;
}

export function renderPromptTemplate(
  template: PromptTemplateFile,
  variables: TemplateVariableMap = {},
): RenderedPrompt {
  return {
    system: renderPromptSectionTemplate(template, 'system', variables),
    user: renderPromptSectionTemplate(template, 'user', variables),
  };
}

export function renderPromptSectionTemplate(
  template: PromptTemplateFile,
  section: PromptSectionKey,
  variables: TemplateVariableMap = {},
): string {
  const content = template[section];
  return content ? renderTemplate(content, variables) : '';
}

export function renderPrompt(
  id: string,
  variables: TemplateVariableMap = {},
): RenderedPrompt {
  return renderPromptTemplate(loadPromptTemplateFile(id), variables);
}

export function renderPromptSection(
  id: string,
  section: PromptSectionKey,
  variables: TemplateVariableMap = {},
): string {
  return renderPromptSectionTemplate(
    loadPromptTemplateFile(id),
    section,
    variables,
  );
}

export function renderPromptSystem(
  id: string,
  variables: TemplateVariableMap = {},
): string {
  return renderPromptSection(id, 'system', variables);
}

export function renderPromptUser(
  id: string,
  variables: TemplateVariableMap = {},
): string {
  return renderPromptSection(id, 'user', variables);
}
