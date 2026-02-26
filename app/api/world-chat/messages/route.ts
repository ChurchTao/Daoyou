import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  createMessage,
  listLatestMessages,
  listMessages,
} from '@/lib/repositories/worldChatRepository';
import { checkAndAcquireCooldown } from '@/lib/redis/worldChatLimiter';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const TextMessageSchema = z.object({
  messageType: z.literal('text'),
  textContent: z.string().trim().optional(),
  payload: z
    .object({
      text: z.string().trim(),
    })
    .optional(),
});

function countChars(input: string): number {
  return Array.from(input).length;
}

function normalizeText(payload: z.infer<typeof TextMessageSchema>): string {
  return (payload.textContent ?? payload.payload?.text ?? '').trim();
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limitRaw = searchParams.get('limit');

  if (limitRaw) {
    const limitParsed = parseInt(limitRaw, 10);
    const limit = Number.isNaN(limitParsed)
      ? 5
      : Math.min(50, Math.max(1, limitParsed));
    const messages = await listLatestMessages(limit);
    return NextResponse.json({
      success: true,
      data: messages,
    });
  }

  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeRaw = parseInt(searchParams.get('pageSize') || '20', 10);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSize = Number.isNaN(pageSizeRaw)
    ? 20
    : Math.min(100, Math.max(1, pageSizeRaw));

  const result = await listMessages({ page, pageSize });
  return NextResponse.json({
    success: true,
    data: result.messages,
    pagination: {
      page,
      pageSize,
      hasMore: result.hasMore,
    },
  });
}

export const POST = withActiveCultivator(
  async (req: NextRequest, { user, cultivator }) => {
    try {
      const body = await req.json();
      const parsed = TextMessageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: '消息格式错误，仅支持文本消息' },
          { status: 400 },
        );
      }

      const text = normalizeText(parsed.data);
      const textLength = countChars(text);
      if (textLength < 1 || textLength > 100) {
        return NextResponse.json(
          { success: false, error: '消息长度需在 1-100 字之间' },
          { status: 400 },
        );
      }

      const cooldown = await checkAndAcquireCooldown(cultivator.id);
      if (!cooldown.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `请 ${cooldown.remainingSeconds} 秒后再发言`,
            remainingSeconds: cooldown.remainingSeconds,
          },
          { status: 429 },
        );
      }

      const message = await createMessage({
        senderUserId: user.id,
        senderCultivatorId: cultivator.id,
        senderName: cultivator.name,
        senderRealm: cultivator.realm,
        senderRealmStage: cultivator.realm_stage,
        messageType: 'text',
        textContent: text,
        payload: { text },
      });

      return NextResponse.json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.error('Create world chat message error:', error);
      return NextResponse.json(
        { success: false, error: '发送失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
