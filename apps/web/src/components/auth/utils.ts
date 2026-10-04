import type { AuthActionError } from '@app/lib/auth/authContext';

export type EmailOtpSource = 'login' | 'signup';

const EMAIL_OTP_NAME_REQUIRED_MESSAGE = '首次注册请填写昵称';

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
    displayName,
    source,
  }: {
    email?: string;
    displayName?: string;
    source?: EmailOtpSource;
  } = {},
) {
  const searchParams = new URLSearchParams();
  const trimmedEmail = email?.trim();
  const trimmedDisplayName = displayName?.trim();

  if (trimmedEmail) {
    searchParams.set('email', trimmedEmail);
  }

  if (trimmedDisplayName) {
    searchParams.set('name', trimmedDisplayName);
  }

  if (source === 'signup') {
    searchParams.set('source', source);
  }

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function isEmailOtpNameRequiredError(
  error: AuthActionError | null | undefined,
) {
  return (
    error?.message === EMAIL_OTP_NAME_REQUIRED_MESSAGE ||
    error?.originalMessage === EMAIL_OTP_NAME_REQUIRED_MESSAGE
  );
}

export function getEmailOtpVerifyFieldErrors({
  otp,
  displayName,
  displayNameRequired,
}: {
  otp: string;
  displayName: string;
  displayNameRequired: boolean;
}) {
  return {
    otp: validateRequiredField(otp, '请输入验证码'),
    displayName: displayNameRequired
      ? validateRequiredField(displayName, '请输入昵称')
      : undefined,
  };
}
