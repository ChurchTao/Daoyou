import type { AuthActionError } from '@app/lib/auth/authContext';

export type EmailOtpSource = 'login' | 'signup';

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateEmailField(email: string) {
  if (!email.trim()) {
    return '请输入邮箱';
  }

  if (!isValidEmail(email)) {
    return '邮箱格式错误';
  }

  return undefined;
}

export function validateRequiredField(value: string, message: string) {
  if (!value.trim()) {
    return message;
  }

  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
) {
  if (!confirmPassword.trim()) {
    return '请再次输入密码';
  }

  if (password !== confirmPassword) {
    return '两次输入的密码不一致';
  }

  return undefined;
}

export function toErrorMessage(
  error: AuthActionError | null,
  fallback: string,
) {
  if (!error?.message) {
    return fallback;
  }

  if (error.status === 429 || error.code === 'TOO_MANY_ATTEMPTS') {
    return '请求过于频繁，请一个时辰后再试';
  }

  if (error.code === 'EMAIL_NOT_VERIFIED') {
    return '邮箱尚未验证，新的验证邮件已发送，请前往邮箱完成验证。';
  }

  return error.message;
}

export function buildEmailOtpTarget(
  pathname: string,
  {
    email,
    source,
  }: {
    email?: string;
    source?: EmailOtpSource;
  } = {},
) {
  const searchParams = new URLSearchParams();
  const trimmedEmail = email?.trim();

  if (trimmedEmail) {
    searchParams.set('email', trimmedEmail);
  }

  if (source === 'signup') {
    searchParams.set('source', source);
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
