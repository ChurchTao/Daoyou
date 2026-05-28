import type { RetreatStreamEvent } from '@shared/contracts/retreat';
import { describe, expect, it, vi } from 'vitest';
import {
  appendRetreatStory,
  buildReincarnateContext,
  consumeRetreatStream,
  isSuccessfulBreakthrough,
  readRetreatStream,
} from './retreatStream';

function createStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  );
}

function encodeEvent(event: RetreatStreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

describe('retreatStream', () => {
  it('reads result and chunk events across split SSE frames', async () => {
    const resultEvent = encodeEvent({
      type: 'result',
      data: {
        action: 'breakthrough',
        storyType: 'breakthrough',
        summary: {
          success: true,
        },
      } as any,
    });
    const chunkOne = encodeEvent({ type: 'chunk', text: '灵潮翻卷，' });
    const chunkTwo = encodeEvent({ type: 'chunk', text: '石门乍开。' });

    const response = createStreamResponse([
      resultEvent.slice(0, 19),
      resultEvent.slice(19) + chunkOne.slice(0, 12),
      chunkOne.slice(12) + chunkTwo,
    ]);

    const onResult = vi.fn();
    const onChunk = vi.fn();

    await readRetreatStream(response, {
      onResult,
      onChunk,
    });

    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'breakthrough',
        storyType: 'breakthrough',
      }),
    );
    expect(onChunk).toHaveBeenNthCalledWith(1, '灵潮翻卷，');
    expect(onChunk).toHaveBeenNthCalledWith(2, '石门乍开。');
  });

  it('reports stream errors after the result payload arrives', async () => {
    const response = createStreamResponse([
      encodeEvent({
        type: 'result',
        data: {
          action: 'cultivate',
          summary: {
            exp_gained: 18,
          },
        } as any,
      }),
      encodeEvent({
        type: 'error',
        error: '天机推演中断，此番结果已然落定。',
      }),
    ]);

    const onError = vi.fn();

    await readRetreatStream(response, {
      onResult: vi.fn(),
      onError,
    });

    expect(onError).toHaveBeenCalledWith('天机推演中断，此番结果已然落定。');
  });

  it('supports story appends and breakthrough celebration guards', () => {
    const next = appendRetreatStory(
      {
        action: 'breakthrough',
        summary: {
          success: true,
        } as any,
        story: '第一句',
      },
      '，第二句',
    );

    expect(next.story).toBe('第一句，第二句');
    expect(isSuccessfulBreakthrough(next)).toBe(true);
    expect(
      isSuccessfulBreakthrough({
        action: 'cultivate',
        summary: {
          exp_gained: 12,
        } as any,
      }),
    ).toBe(false);
  });

  it('caches depleted reincarnate context while the story is still streaming', async () => {
    const response = createStreamResponse([
      encodeEvent({
        type: 'result',
        data: {
          action: 'cultivate',
          depleted: true,
          storyType: 'lifespan',
          summary: {
            exp_gained: 12,
          },
        } as any,
      }),
      encodeEvent({ type: 'chunk', text: '炉火将熄，' }),
      encodeEvent({ type: 'chunk', text: '余念仍指向大道。' }),
    ]);

    const onResult = vi.fn();
    const onStoryUpdate = vi.fn();
    const onReincarnateContext = vi.fn();

    const streamState = await consumeRetreatStream(response, {
      cultivatorSnapshot: {
        name: '韩立',
        realm: '筑基',
        realm_stage: '初期',
      },
      onResult,
      onStoryUpdate,
      onReincarnateContext,
    });

    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({
        depleted: true,
        storyType: 'lifespan',
      }),
    );
    expect(onStoryUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        story: '炉火将熄，',
      }),
    );
    expect(onStoryUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        story: '炉火将熄，余念仍指向大道。',
      }),
    );
    expect(onReincarnateContext).toHaveBeenLastCalledWith({
      story: '炉火将熄，余念仍指向大道。',
      name: '韩立',
      realm: '筑基',
      realm_stage: '初期',
    });
    expect(streamState.reincarnateContext).toEqual({
      story: '炉火将熄，余念仍指向大道。',
      name: '韩立',
      realm: '筑基',
      realm_stage: '初期',
    });
  });

  it('builds reincarnate context only for depleted results', () => {
    expect(
      buildReincarnateContext(
        {
          name: '韩立',
          realm: '筑基',
          realm_stage: '初期',
        },
        {
          action: 'cultivate',
          depleted: true,
          story: '前尘一梦。',
          summary: {
            exp_gained: 12,
          } as any,
        },
      ),
    ).toEqual({
      story: '前尘一梦。',
      name: '韩立',
      realm: '筑基',
      realm_stage: '初期',
    });

    expect(
      buildReincarnateContext(
        {
          name: '韩立',
          realm: '筑基',
          realm_stage: '初期',
        },
        {
          action: 'cultivate',
          summary: {
            exp_gained: 12,
          } as any,
        },
      ),
    ).toBeNull();
  });
});
