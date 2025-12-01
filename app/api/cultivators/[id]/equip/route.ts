import { createClient } from '@/lib/supabase/server';
import { equipEquipment } from '@/lib/repositories/cultivatorRepository';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/cultivators/:id/equip
 * 获取角色装备状态
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cultivatorId } = await params;
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前用户，验证用户身份
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 输入验证
    if (!cultivatorId || typeof cultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的角色ID' },
        { status: 400 }
      );
    }

    // 检查角色是否属于当前用户
    const cultivator = await db
      .select({ id: schema.cultivators.id })
      .from(schema.cultivators)
      .where(
        eq(schema.cultivators.id, cultivatorId)
      );

    if (cultivator.length === 0) {
      return NextResponse.json({ error: '角色不存在或无权限操作' }, { status: 404 });
    }

    // 获取装备状态
    const equippedItems = await db
      .select()
      .from(schema.equippedItems)
      .where(eq(schema.equippedItems.cultivatorId, cultivatorId));

    if (equippedItems.length === 0) {
      // 如果没有装备状态记录，返回空状态
      return NextResponse.json({
        success: true,
        data: { weapon: undefined, armor: undefined, accessory: undefined },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        weapon: equippedItems[0].weaponId,
        armor: equippedItems[0].armorId,
        accessory: equippedItems[0].accessoryId,
      },
    });
  } catch (error) {
    console.error('获取角色装备状态 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取角色装备状态失败，请稍后重试'
        : '获取角色装备状态失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/cultivators/:id/equip
 * 装备/卸下装备
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前用户，验证用户身份
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const { id: cultivatorId } = await params;
    const body = await request.json();
    const { equipmentId } = body;

    // 输入验证
    if (
      !cultivatorId ||
      typeof cultivatorId !== 'string' ||
      !equipmentId ||
      typeof equipmentId !== 'string'
    ) {
      return NextResponse.json(
        { error: '请提供有效的角色ID和装备ID' },
        { status: 400 }
      );
    }

    // 装备或卸下装备
    const equippedItems = await equipEquipment(user.id, cultivatorId, equipmentId);

    return NextResponse.json({
      success: true,
      data: equippedItems,
    });
  } catch (error) {
    console.error('装备/卸下装备 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '装备操作失败，请稍后重试'
        : '装备操作失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
