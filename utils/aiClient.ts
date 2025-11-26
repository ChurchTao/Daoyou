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
    throw new Error('OPENAI_API_KEY 环境变量未设置。请在 .env.local 文件中配置 OPENAI_API_KEY');
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
 * @returns 生成的角色 JSON 字符串
 */
export async function generateCharacter(prompt: string): Promise<string> {
  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一个修仙世界造化玉碟，专门根据用户描述生成修仙者角色。请严格按照 JSON 格式输出，不要添加任何其他文字说明。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // 稍微提高创造性
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
    
    throw new Error(`生成角色失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 调用 AI 生成战斗播报
 * @param prompt 战斗播报 prompt
 * @returns 生成的战斗播报文本
 */
export async function generateBattleReport(prompt: string): Promise<string> {
  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: '你是一位修仙小说作家，擅长写精彩的战斗场景。请根据提供的角色信息，写一段50-150字的激烈对决描写，要求有动作、有台词、有转折，语言要符合修仙小说的风格。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.9, // 提高创造性，让战斗描写更生动
      max_tokens: 500, // 限制最大长度
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('AI 返回的内容为空');
    }

    return content.trim();
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
    
    throw new Error(`生成战斗播报失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
