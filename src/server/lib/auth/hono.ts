import { auth } from '@server/lib/auth/auth';
import { authUsers } from '@server/lib/auth/schema';
import { verifyTurnstileToken } from '@server/lib/auth/turnstile';
import { db } from '@server/lib/drizzle/db';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';

const CAPTCHA_PROTECTED_PATHS = new Set([
  '/api/auth/sign-in/email',
  '/api/auth/sign-up/email',
  '/api/auth/request-password-reset',
  '/api/auth/email-otp/send-verification-otp',
]);

function getRequestIp(context: Context): string | undefined {
  const forwardedFor = context.req.header('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || undefined;
  }

  return context.req.header('cf-connecting-ip') || undefined;
}

async function readRequestBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = (await request.clone().json().catch(() => null)) as
      | Record<string, unknown>
      | null;

    return body ?? {};
  }

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.clone().formData();
    return Object.fromEntries(form.entries());
  }

  return {};
}

function authError(message: string, status = 400) {
  return Response.json(
    {
      success: false,
      error: message,
    },
    { status },
  );
}

async function validateCaptcha(context: Context): Promise<Response | null> {
  if (!CAPTCHA_PROTECTED_PATHS.has(context.req.path)) {
    return null;
  }

  const body = await readRequestBody(context.req.raw);
  const captchaTokenHeader = context.req.header('x-turnstile-token');
  const captchaTokenBody =
    typeof body.captchaToken === 'string' ? body.captchaToken : '';
  const captchaToken = captchaTokenHeader || captchaTokenBody;

  if (!captchaToken) {
    return authError('请先完成人机验证');
  }

  const verified = await verifyTurnstileToken(captchaToken, getRequestIp(context));

  if (!verified) {
    return authError('人机验证失败，请重试');
  }

  return null;
}

async function validateOtpSignUpName(context: Context): Promise<Response | null> {
  if (context.req.path !== '/api/auth/sign-in/email-otp') {
    return null;
  }

  const body = await readRequestBody(context.req.raw);
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';

  if (!email) {
    return authError('缺少邮箱地址');
  }

  const existingUser = await db()
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, email))
    .limit(1);

  if (existingUser.length === 0 && !name) {
    return authError('首次注册请填写昵称');
  }

  return null;
}

export async function handleAuthRequest(context: Context): Promise<Response> {
  if (context.req.method === 'POST') {
    const captchaError = await validateCaptcha(context);
    if (captchaError) {
      return captchaError;
    }

    const otpNameError = await validateOtpSignUpName(context);
    if (otpNameError) {
      return otpNameError;
    }
  }

  return auth.handler(context.req.raw);
}
