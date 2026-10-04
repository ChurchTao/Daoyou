import { BetterFetchError } from '@better-fetch/fetch';
import { createContext } from 'react';
import { authClient } from './client';

type SessionPayload = typeof authClient.$Infer.Session;
type AuthSession = SessionPayload['session'];
type AuthUser = SessionPayload['user'];

export type AuthActionError = {
  code?: string;
  message: string;
  originalMessage?: string;
  status?: number;
  statusText?: string;
};

export interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  signUpWithPassword: (
    name: string,
    email: string,
    password: string,
    captchaPayload?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signInWithPassword: (
    email: string,
    password: string,
    captchaPayload?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signInWithEmailOtp: (
    email: string,
    captchaPayload?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  verifyEmailOtp: (
    email: string,
    otp: string,
    name?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signInWithGitHub: (
    callbackURL?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  requestPasswordReset: (
    email: string,
    captchaPayload?: string,
    redirectTo?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  resetPassword: (
    token: string,
    newPassword: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signOut: () => Promise<{ error: AuthActionError | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getDefaultResetRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/reset-password';
  }

  return new URL('/reset-password', window.location.origin).toString();
}

export function getDefaultGameRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/game';
  }

  return new URL('/game', window.location.origin).toString();
}

export function getCaptchaFetchOptions(captchaPayload?: string) {
  if (!captchaPayload) {
    return undefined;
  }

  return {
    headers: {
      'x-altcha-payload': captchaPayload,
    },
  };
}

export function toAuthActionError(error: unknown): AuthActionError | null {
  if (!error) {
    return null;
  }

  if (error instanceof BetterFetchError) {
    return {
      code:
        typeof error.error?.code === 'string' ? error.error.code : undefined,
      message:
        typeof error.error?.message === 'string'
          ? error.error.message
          : error.message,
      originalMessage:
        typeof error.error?.originalMessage === 'string'
          ? error.error.originalMessage
          : undefined,
      status: error.status,
      statusText: error.statusText,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return {
      code:
        'code' in error && typeof error.code === 'string'
          ? error.code
          : undefined,
      message: error.message,
      originalMessage:
        'originalMessage' in error && typeof error.originalMessage === 'string'
          ? error.originalMessage
          : undefined,
      status:
        'status' in error && typeof error.status === 'number'
          ? error.status
          : undefined,
      statusText:
        'statusText' in error && typeof error.statusText === 'string'
          ? error.statusText
          : undefined,
    };
  }

  return {
    message: '认证请求失败，请稍后重试',
  };
}
