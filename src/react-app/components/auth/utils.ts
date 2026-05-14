import type { AuthActionError } from '@app/lib/auth/AuthContext';

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateEmailField(email: string) {
  if (!email.trim()) {
    return '请输入飞鸽传书地址';
  }

  if (!isValidEmail(email)) {
    return '飞鸽传书地址格式有误';
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
    return '请再次输入口令';
  }

  if (password !== confirmPassword) {
    return '两次输入的口令不一致';
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

  if (error.message.toLowerCase().includes('rate')) {
    return '请求过于频繁，请一个时辰后再试';
  }

  return error.message;
}
