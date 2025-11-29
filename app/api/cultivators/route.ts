import { NextRequest, NextResponse } from "next/server";
import {
  createCultivator,
  getCultivatorsByUserId,
  getCultivatorById,
  deleteCultivator,
} from "@/lib/repositories/cultivatorRepository";
import type { Cultivator, BattleProfile } from "@/types/cultivator";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/cultivators
 * 创建角色
 */
export async function POST(request: NextRequest) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前会话，验证用户身份
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    const body = await request.json();
    const { cultivatorData, battleProfile } = body;

    // 验证输入数据完整性
    if (
      !cultivatorData ||
      typeof cultivatorData !== "object" ||
      !cultivatorData.name ||
      !cultivatorData.prompt ||
      !battleProfile ||
      typeof battleProfile !== "object" ||
      !battleProfile.attributes ||
      !battleProfile.skills
    ) {
      return NextResponse.json(
        { error: "请提供完整的角色数据" },
        { status: 400 }
      );
    }

    // 验证技能数据
    if (
      !Array.isArray(battleProfile.skills) ||
      battleProfile.skills.length === 0
    ) {
      return NextResponse.json(
        { error: "角色必须至少有一个技能" },
        { status: 400 }
      );
    }

    // 验证战斗属性数据
    if (
      typeof battleProfile.attributes.vitality !== "number" ||
      typeof battleProfile.attributes.spirit !== "number" ||
      typeof battleProfile.attributes.wisdom !== "number" ||
      typeof battleProfile.attributes.speed !== "number"
    ) {
      return NextResponse.json(
        { error: "请提供有效的战斗属性" },
        { status: 400 }
      );
    }

    // 使用事务创建角色，确保数据一致性
    const createdCultivator = await createCultivator(
      session.user.id,
      cultivatorData as Omit<Cultivator, "id" | "battleProfile">,
      battleProfile as BattleProfile
    );

    return NextResponse.json({
      success: true,
      data: createdCultivator,
    });
  } catch (error) {
    console.error("创建角色 API 错误:", error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "创建角色失败，请稍后重试"
        : "创建角色失败，请稍后重试";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/cultivators
 * 获取用户的所有角色
 */
export async function GET(request: NextRequest) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前会话，验证用户身份
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    // 获取角色ID参数（可选）
    const searchParams = request.nextUrl.searchParams;
    const cultivatorId = searchParams.get("id");

    if (cultivatorId) {
      // 获取单个角色
      const cultivator = await getCultivatorById(session.user.id, cultivatorId);

      if (!cultivator) {
        return NextResponse.json({ error: "角色不存在" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: cultivator,
      });
    } else {
      // 获取所有角色
      const cultivators = await getCultivatorsByUserId(session.user.id);

      return NextResponse.json({
        success: true,
        data: cultivators,
      });
    }
  } catch (error) {
    console.error("获取角色 API 错误:", error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "获取角色失败，请稍后重试"
        : "获取角色失败，请稍后重试";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/cultivators
 * 删除角色
 */
export async function DELETE(request: NextRequest) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前会话，验证用户身份
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: "未授权访问" }, { status: 401 });
    }

    // 获取角色ID参数
    const searchParams = request.nextUrl.searchParams;
    const cultivatorId = searchParams.get("id");

    if (!cultivatorId) {
      return NextResponse.json({ error: "请提供角色ID" }, { status: 400 });
    }

    // 删除角色
    const success = await deleteCultivator(session.user.id, cultivatorId);

    if (!success) {
      return NextResponse.json(
        { error: "删除角色失败或角色不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "角色删除成功",
    });
  } catch (error) {
    console.error("删除角色 API 错误:", error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "删除角色失败，请稍后重试"
        : "删除角色失败，请稍后重试";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
