import { deleteVerificationCode, verifyCode } from '@/lib/email/verification';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    // Validate inputs
    if (!email || !code) {
      return NextResponse.json(
        { success: false, error: '请填写所有信息' },
        { status: 400 },
      );
    }

    // Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 },
      );
    }

    // Check if user is anonymous
    if (!user.is_anonymous) {
      return NextResponse.json(
        {
          success: false,
          error: '你的真身已与神识绑定，无需重复认主',
        },
        { status: 400 },
      );
    }

    // Verify the code
    const isValid = await verifyCode(email, code);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: '天机印有误，请重新输入',
        },
        { status: 400 },
      );
    }

    // Update user with email (this converts anonymous to permanent)
    const { error: updateError } = await supabase.auth.updateUser({
      email: email.toLowerCase(),
      data: {
        is_anonymous: false, // Explicitly set is_anonymous to false
      },
    });

    if (updateError) {
      console.error('Email binding error:', updateError);
      return NextResponse.json(
        {
          success: false,
          error: '神识认主失败，请稍后重试',
        },
        { status: 500 },
      );
    }

    // Refresh the session to get updated JWT with is_anonymous: false
    await supabase.auth.refreshSession();

    // Delete the verification code
    await deleteVerificationCode(email);

    return NextResponse.json({
      success: true,
      message: '神识认主成功！真身已与你绑定。',
    });
  } catch (error) {
    console.error('Bind email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '神识认主失败，请稍后重试',
      },
      { status: 500 },
    );
  }
}
