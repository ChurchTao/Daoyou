import { auth } from '@server/lib/auth/auth';
import { authUsers } from '@server/lib/auth/schema';
import {
  isAltchaServerEnabled,
  verifyAltchaPayload,
  type AltchaAction,
} from '@server/lib/auth/altcha';
import { db } from '@server/lib/drizzle/db';
import { eq } from 'drizzle-orm';
import type { Context } from 'hono';

const CAPTCHA_ACTION_BY_PATH = new Map<string, AltchaAction>([
  ['/api/auth/sign-in/email', 'sign-in'],
  ['/api/auth/sign-up/email', 'sign-up'],
  ['/api/auth/request-password-reset', 'password-reset'],
  ['/api/auth/email-otp/send-verification-otp', 'email-otp'],
]);
const ADMIN_AUTH_PATH = '/api/auth/admin';

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
  const action = CAPTCHA_ACTION_BY_PATH.get(context.req.path);
  if (!action) {
    return null;
  }

  if (!isAltchaServerEnabled()) {
    return authError('人机验证服务未配置', 503);
  }

  const body = await readRequestBody(context.req.raw);
  const captchaPayloadHeader = context.req.header('x-altcha-payload');
  const captchaPayloadBody =
    typeof body.altcha === 'string'
      ? body.altcha
      : typeof body.captchaPayload === 'string'
        ? body.captchaPayload
        : '';
  const captchaPayload = captchaPayloadHeader || captchaPayloadBody;

  if (!captchaPayload) {
    return authError('请先完成人机验证');
  }

  const verification = await verifyAltchaPayload(captchaPayload, action);

  if (verification === 'unavailable') {
    return authError('人机验证服务暂不可用，请稍后重试', 503);
  }

  if (verification !== 'verified') {
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

  const existingUser = await db
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
  if (
    context.req.path === ADMIN_AUTH_PATH ||
    context.req.path.startsWith(`${ADMIN_AUTH_PATH}/`)
  ) {
    return authError('未找到该接口', 404);
  }

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
