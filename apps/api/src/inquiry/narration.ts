import type { InquiryPlay } from '@daoyou/game-domain/inquiry';
import { acceptInquiryNarration } from '@daoyou/game-rules/inquiry';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { streamAiText } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';

export interface InquiryNarrationRequest {
  play: InquiryPlay;
  fallback: string;
  lines: string[];
}

/**
 * Narrate one committed result. The model never receives the hidden truth.
 * A failed or leaking paragraph is discarded for the blueprint sentence.
 */
export async function streamInquiryNarration(
  request: InquiryNarrationRequest,
  onToken: (token: string) => void,
): Promise<string> {
  const prompt = renderPrompt('inquiry-narration', {
    userContextJson: stableCompactStringify({ facts: request.lines }),
  });
  let full = '';
  try {
    const result = streamAiText({
      system: prompt.system,
      prompt: prompt.user,
      sceneId: 'inquiry-narration',
      maxOutputTokens: 400,
    });
    for await (const token of result.textStream) {
      full += token;
      onToken(token);
    }
  } catch (error) {
    console.warn(
      `[inquiry-narration] 改用蓝图短句: ${
        error instanceof Error ? error.message : '未知错误'
      }`,
    );
    return request.fallback;
  }
  const text = full.trim().slice(0, 400);
  if (!acceptInquiryNarration(request.play, text, request.lines)) {
    console.warn('[inquiry-narration] 叙述越出事实，改用蓝图短句');
    return request.fallback;
  }
  return text;
}
