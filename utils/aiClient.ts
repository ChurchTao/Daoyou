import OpenAI from 'openai';

/**
 * AI 客户端工具
 * 用于调用 OpenAI API 生成角色和战斗播报
 *
 * 环境变量配置：
 * - OPENAI_API_KEY: OpenAI API Key（必需）
 * - OPENAI_BASE_URL: 自定义 API 地址（可选，用于兼容其他 OpenAI 兼容的 API）
 * - OPENAI_MODEL: 使用的模型名称（可选，默认 gpt-4o-mini）
 */

// 初始化 OpenAI 客户端
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY 环境变量未设置。请在 .env.local 文件中配置 OPENAI_API_KEY',
    );
  }

  const baseURL = process.env.OPENAI_BASE_URL;

  return new OpenAI({
    apiKey,
    ...(baseURL && { baseURL }), // 如果设置了自定义 baseURL，则使用它（用于兼容其他 API）
  });
}

/**
 * 调用 AI 生成角色
 * @param prompt 角色生成 prompt
 * @param userInput 用户输入
 * @returns 生成的角色 JSON 字符串
 */
export async function generateCharacter(
  prompt: string,
  userInput: string,
): Promise<string> {
  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: userInput,
        },
      ],
      max_tokens: 8192,
      temperature: 0.6, // 稍微提高创造性
      top_p: 0.95,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('AI 返回的内容为空');
    }

    return content;
  } catch (error) {
    console.error('生成角色失败:', error);

    if (error instanceof Error) {
      // 处理 OpenAI API 错误
      if (error.message.includes('API key')) {
        throw new Error('API Key 无效，请检查 OPENAI_API_KEY 环境变量');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('API 调用频率过高，请稍后再试');
      }
      if (error.message.includes('insufficient_quota')) {
        throw new Error('API 配额不足，请检查账户余额');
      }
    }

    throw new Error(
      `生成角色失败: ${error instanceof Error ? error.message : '未知错误'}`,
    );
  }
}

/**
 * 调用 AI 生成战斗播报（流式输出）
 * @param prompt 战斗播报系统提示词 prompt
 * @param userPrompt 用户输入的战斗播报 prompt
 * @param onChunk 接收到新内容块时的回调函数
 * @returns Promise，解析时返回完整文本
 */
export async function generateBattleReportStream(
  prompt: string,
  userPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const stream = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: prompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      max_tokens: 8192,
      temperature: 0.6, // 稍微提高创造性
      stream: true, // 启用流式输出
    });

    let fullContent = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
    }

    return fullContent.trim();
  } catch (error) {
    console.error('生成战斗播报失败:', error);

    if (error instanceof Error) {
      // 处理 OpenAI API 错误
      if (error.message.includes('API key')) {
        throw new Error('API Key 无效，请检查 OPENAI_API_KEY 环境变量');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('API 调用频率过高，请稍后再试');
      }
      if (error.message.includes('insufficient_quota')) {
        throw new Error('API 配额不足，请检查账户余额');
      }
    }

    throw new Error(
      `生成战斗播报失败: ${error instanceof Error ? error.message : '未知错误'}`,
    );
  }
}

/**
 * 调用 AI 生成战斗播报（非流式，保留用于兼容）
 * @param prompt 战斗播报 prompt
 * @returns 生成的战斗播报文本
 */
export async function generateBattleReport(
  prompt: string,
  userPrompt: string,
): Promise<string> {
  let fullContent = '';
  await generateBattleReportStream(prompt, userPrompt, (chunk) => {
    fullContent += chunk;
  });
  return fullContent;
}

export async function generateNarrative(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.7,
): Promise<string> {
  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature,
      top_p: 0.95,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI 返回的内容为空');
    }
    return content.trim();
  } catch (error) {
    console.error('生成叙事文本失败:', error);
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw new Error('API Key 无效，请检查 OPENAI_API_KEY 环境变量');
      }
      if (error.message.includes('rate limit')) {
        throw new Error('AI 接口调用频繁，请稍后再试');
      }
      if (error.message.includes('insufficient_quota')) {
        throw new Error('AI 接口配额不足，请检查账户余额');
      }
    }
    throw new Error(
      `生成叙事文本失败: ${error instanceof Error ? error.message : '未知错误'}`,
    );
  }
}

/**
 * 解析 AI 返回的 JSON（处理可能的格式问题）
 * @param jsonString AI 返回的 JSON 字符串
 * @returns 解析后的对象
 */
export function parseAIResponse(jsonString: string): Record<string, unknown> {
  try {
    // 尝试直接解析
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    // 如果失败，尝试提取 JSON 部分（AI 可能返回了额外的文字）
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch (e) {
        console.error('提取 JSON 后仍无法解析:', e);
        throw new Error('无法解析 AI 返回的 JSON 格式');
      }
    }
    throw new Error('无法解析 AI 响应：未找到有效的 JSON 内容');
  }
}
