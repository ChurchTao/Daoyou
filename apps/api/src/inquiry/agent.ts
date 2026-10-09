import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiToolTurn } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { inquiryToolActionId } from '@daoyou/game-rules/inquiry';
import { HttpException } from '@nestjs/common';
import { tool, type ToolSet } from 'ai';
import { z } from 'zod';

type VisibleView = {
  revision: number;
  prose: string;
  clues: Array<{ title: string }>;
  actions: Array<{ id: string; label: string }>;
};

type Committed = {
  response: { data: VisibleView };
  stream: {
    cultivatorId: string;
    runId: string;
    revision: number;
    key: string;
    fallback: string;
    lines: string[];
    play: import('@daoyou/game-domain/inquiry').InquiryPlay;
  } | null;
};

function failureMessage(error: unknown) {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'error' in body) {
      const value = (body as { error?: unknown }).error;
      if (typeof value === 'string') return value;
    }
  }
  return '这件事没有做成';
}

/**
 * One host turn. The model may only propose a tool call.
 * The tool handler commits through the rule engine, then returns the visible result.
 */
export async function runInquiryToolTurn(options: {
  utterance: string;
  view: VisibleView;
  emit: (event: string, data: unknown) => void;
  commit: (
    actionId: string,
    expectedRevision: number,
  ) => Promise<Committed>;
}): Promise<Committed | null> {
  let view = options.view;
  let last: Committed | null = null;
  const allowed = () => new Set(view.actions.map((action) => action.id));
  const ids = (prefix: string) =>
    [...allowed()].filter((id) => id.startsWith(prefix)).join('、') || '无';

  const commit = async (actionId: string | null) => {
    if (!actionId || !allowed().has(actionId)) {
      return { ok: false, message: '眼前做不到这件事' };
    }
    try {
      const detailed = await options.commit(actionId, view.revision);
      view = detailed.response.data;
      last = detailed;
      options.emit('tool', { actionId, ok: true });
      options.emit('state', detailed.response);
      return {
        ok: true,
        message: detailed.response.data.prose,
        actions: view.actions.map((action) => action.label),
      };
    } catch (error) {
      options.emit('tool', { actionId, ok: false });
      return { ok: false, message: failureMessage(error) };
    }
  };

  const tools: ToolSet = {
    inspect: tool({
      description: `查看当前地点的一件东西。可用目标：${ids('examine:')}`,
      inputSchema: z.object({ targetId: z.string() }).strict(),
      execute: async (input) => commit(inquiryToolActionId('inspect', input)),
    }),
    move: tool({
      description: `走到另一个已经开放的地点。可用目标：${ids('move:')}`,
      inputSchema: z.object({ destinationId: z.string() }).strict(),
      execute: async (input) => commit(inquiryToolActionId('move', input)),
    }),
    pay: tool({
      description: `对已经看过、并且抠不开的东西付出代价。可用：${ids('cost:')}`,
      inputSchema: z.object({ objectId: z.string(), costId: z.string() }).strict(),
      execute: async (input) => commit(inquiryToolActionId('pay', input)),
    }),
    compare: tool({
      description: `对照两条已经记下的线索。可用：${ids('compare:')}`,
      inputSchema: z.object({ compareId: z.string() }).strict(),
      execute: async (input) => commit(inquiryToolActionId('compare', input)),
    }),
    open: tool({
      description: `打开已经打量过的容器。可用：${ids('open:')}`,
      inputSchema: z.object({ targetId: z.string() }).strict(),
      execute: async (input) => commit(inquiryToolActionId('open', input)),
    }),
    take: tool({
      description: `取下已经可以拿走的东西。可用：${ids('take:')}`,
      inputSchema: z.object({ targetId: z.string() }).strict(),
      execute: async (input) => commit(inquiryToolActionId('take', input)),
    }),
  };

  const prompt = renderPrompt('inquiry-agent', {
    userContextJson: stableCompactStringify({
      place: view.prose,
      clues: view.clues.map((clue) => clue.title),
      actions: view.actions.map((action) => ({ id: action.id, label: action.label })),
      utterance: options.utterance,
    }),
  });

  try {
    await generateAiToolTurn({
      sceneId: 'inquiry-agent',
      system: prompt.system,
      prompt: prompt.user,
      tools,
      maxSteps: 3,
    });
  } catch (error) {
    if (!last) throw error;
  }
  return last;
}
