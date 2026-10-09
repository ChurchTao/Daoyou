import type { InquiryCaseFile } from '@daoyou/game-domain/inquiry';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { streamAiText } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';

export interface InquiryNarrationRequest {
  caseFile: InquiryCaseFile;
  fallback: string;
  lines: string[];
}

/** Stream a retelling of facts the case already recorded. */
export async function streamInquiryNarration(
  request: InquiryNarrationRequest,
  onToken: (token: string) => void,
): Promise<string> {
  const prompt = renderPrompt('inquiry-narration', {
    userContextJson: stableCompactStringify({
      names: request.caseFile.cast.map((person) => person.name),
      facts: request.lines,
    }),
  });
  try {
    const result = streamAiText({
      system: prompt.system,
      prompt: prompt.user,
      sceneId: 'inquiry-narration',
      maxOutputTokens: 400,
    });
    let full = '';
    for await (const token of result.textStream) {
      full += token;
      onToken(token);
    }
    const text = full.trim().slice(0, 400);
    return text.length >= 8 ? text : request.fallback;
  } catch (error) {
    console.warn(
      `[inquiry-narration] 改用案卷短句: ${
        error instanceof Error ? error.message : '未知错误'
      }`,
    );
    return request.fallback;
  }
}
