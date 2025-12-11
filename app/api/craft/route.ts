import { CreationEngine } from '@/engine/creation/CreationEngine';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const creationEngine = new CreationEngine();

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { cultivatorId, materialIds, prompt, craftType } = body;

    if (
      !cultivatorId ||
      !materialIds ||
      !Array.isArray(materialIds) ||
      materialIds.length === 0 ||
      !craftType
    ) {
      return NextResponse.json(
        { error: '参数缺失，无法开炉' },
        { status: 400 },
      );
    }

    const result = await creationEngine.processRequest(
      user.id,
      cultivatorId,
      materialIds,
      prompt,
      craftType,
    );

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error('Crafting API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '炼制失败，炸炉了！' },
      { status: 500 },
    );
  }
}
