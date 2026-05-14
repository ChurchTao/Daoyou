import { BetterFetchError } from '@better-fetch/fetch';
import { createContext, useContext, type ReactNode } from 'react';
import { authClient } from './client';

type SessionPayload = typeof authClient.$Infer.Session;
type AuthSession = SessionPayload['session'];
type AuthUser = SessionPayload['user'];

export type AuthActionError = {
  code?: string;
  message: string;
  status?: number;
  statusText?: string;
};

interface AuthContextType {
  session: AuthSession | null;
  user: AuthUser | null;
  isLoading: boolean;
  signUpWithPassword: (
    name: string,
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signInWithPassword: (
    email: string,
    password: string,
    captchaToken?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signInWithEmailOtp: (
    email: string,
    captchaToken?: string,
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
    captchaToken?: string,
    redirectTo?: string,
  ) => Promise<{ error: AuthActionError | null }>;
  resetPassword: (
    token: string,
    newPassword: string,
  ) => Promise<{ error: AuthActionError | null }>;
  signOut: () => Promise<{ error: AuthActionError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getDefaultResetRedirectUrl() {
  if (typeof window === 'undefined') {
    return '/reset-password';
  }

  return new URL('/reset-password', window.location.origin).toString();
}

function getCaptchaFetchOptions(captchaToken?: string) {
  if (!captchaToken) {
    return undefined;
  }

  return {
    headers: {
      'x-turnstile-token': captchaToken,
    },
  };
}

function toAuthActionError(error: unknown): AuthActionError | null {
  if (!error) {
    return null;
  }

  if (error instanceof BetterFetchError) {
    return {
      code:
        typeof error.error?.code === 'string' ? error.error.code : undefined,
      message: error.message,
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
    };
  }

  return {
    message: '认证请求失败，请稍后重试',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionState = authClient.useSession();
  const session = sessionState.data?.session ?? null;
  const user = sessionState.data?.user ?? null;

  const signUpWithPassword: AuthContextType['signUpWithPassword'] = async (
    name,
    email,
    password,
    captchaToken,
  ) => {
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      fetchOptions: getCaptchaFetchOptions(captchaToken),
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const signInWithPassword: AuthContextType['signInWithPassword'] = async (
    email,
    password,
    captchaToken,
  ) => {
    const { error } = await authClient.signIn.email({
      email: normalizeEmail(email),
      password,
      fetchOptions: getCaptchaFetchOptions(captchaToken),
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const signInWithEmailOtp: AuthContextType['signInWithEmailOtp'] = async (
    email,
    captchaToken,
  ) => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: normalizeEmail(email),
      type: 'sign-in',
      fetchOptions: getCaptchaFetchOptions(captchaToken),
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const verifyEmailOtp: AuthContextType['verifyEmailOtp'] = async (
    email,
    otp,
    name,
  ) => {
    const { error } = await authClient.signIn.emailOtp({
      email: normalizeEmail(email),
      otp: otp.trim(),
      name: name?.trim() || undefined,
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const signInWithGitHub: AuthContextType['signInWithGitHub'] = async (
    callbackURL = '/game',
  ) => {
    const { error } = await authClient.signIn.social({
      provider: 'github',
      callbackURL,
      errorCallbackURL: '/login',
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const requestPasswordReset: AuthContextType['requestPasswordReset'] = async (
    email,
    captchaToken,
    redirectTo,
  ) => {
    const { error } = await authClient.requestPasswordReset({
      email: normalizeEmail(email),
      redirectTo: redirectTo || getDefaultResetRedirectUrl(),
      fetchOptions: getCaptchaFetchOptions(captchaToken),
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const resetPassword: AuthContextType['resetPassword'] = async (
    token,
    newPassword,
  ) => {
    const { error } = await authClient.resetPassword({
      token,
      newPassword,
    });

    return {
      error: toAuthActionError(error),
    };
  };

  const signOut: AuthContextType['signOut'] = async () => {
    const { error } = await authClient.signOut();

    return {
      error: toAuthActionError(error),
    };
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading: sessionState.isPending,
        signUpWithPassword,
        signInWithPassword,
        signInWithEmailOtp,
        verifyEmailOtp,
        signInWithGitHub,
        requestPasswordReset,
        resetPassword,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
