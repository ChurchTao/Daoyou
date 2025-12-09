import {
  checkRateLimit,
  generateVerificationCode,
  incrementRateLimit,
  storeVerificationCode,
} from '@/lib/email/verification';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: '飞鸽传书地址格式有误' },
        { status: 400 },
      );
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(email);
    if (!withinLimit) {
      return NextResponse.json(
        {
          success: false,
          error: '天机印请求过于频繁，请一个时辰后再试',
        },
        { status: 429 },
      );
    }

    // Check if email is already bound to another account
    const supabase = await createClient();
    const { data: existingUsers } = await supabase.auth.admin.listUsers();

    const emailAlreadyBound = existingUsers?.users.some(
      (user) =>
        user.email?.toLowerCase() === email.toLowerCase() && !user.is_anonymous,
    );

    if (emailAlreadyBound) {
      return NextResponse.json(
        {
          success: false,
          error: '此飞鸽传书地址已被他人占用',
        },
        { status: 400 },
      );
    }

    // Generate and store verification code
    const code = generateVerificationCode();
    await storeVerificationCode(email, code);
    await incrementRateLimit(email);

    // Send email with verification code
    // For now, using Supabase's built-in email (requires configuration)
    // In production, you might want to use a dedicated email service
    await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        verification_code: code,
      },
    });

    // Alternative: If Supabase email not configured, log code for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Verification code for ${email}: ${code}`);
    }

    const response: {
      success: boolean;
      message: string;
      code?: string;
    } = {
      success: true,
      message: '天机印已发往你的飞鸽传书地址',
    };

    if (process.env.NODE_ENV === 'development') {
      response.code = code; // Only for development
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Send verification error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '天机印发送失败，请稍后重试',
      },
      { status: 500 },
    );
  }
}
