import type { ReactNode } from 'react';
import {
  AuthContext,
  getCaptchaFetchOptions,
  getDefaultGameRedirectUrl,
  getDefaultResetRedirectUrl,
  normalizeEmail,
  toAuthActionError,
  type AuthContextType,
} from './authState';
import { authClient } from './client';

export function AuthProvider({ children }: { children: ReactNode }) {
  const sessionState = authClient.useSession();
  const session = sessionState.data?.session ?? null;
  const user = sessionState.data?.user ?? null;

  const syncSessionState = async () => {
    await sessionState.refetch();
  };

  const signUpWithPassword: AuthContextType['signUpWithPassword'] = async (
    name,
    email,
    password,
    captchaPayload,
  ) => {
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: normalizeEmail(email),
      password,
      callbackURL: getDefaultGameRedirectUrl(),
      fetchOptions: getCaptchaFetchOptions(captchaPayload),
    });

    if (!error) {
      await syncSessionState();
    }

    return {
      error: toAuthActionError(error),
    };
  };

  const signInWithPassword: AuthContextType['signInWithPassword'] = async (
    email,
    password,
    captchaPayload,
  ) => {
    const { error } = await authClient.signIn.email({
      email: normalizeEmail(email),
      password,
      callbackURL: getDefaultGameRedirectUrl(),
      fetchOptions: getCaptchaFetchOptions(captchaPayload),
    });

    if (!error) {
      await syncSessionState();
    }

    return {
      error: toAuthActionError(error),
    };
  };

  const signInWithEmailOtp: AuthContextType['signInWithEmailOtp'] = async (
    email,
    captchaPayload,
  ) => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: normalizeEmail(email),
      type: 'sign-in',
      fetchOptions: getCaptchaFetchOptions(captchaPayload),
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

    if (!error) {
      await syncSessionState();
    }

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
    captchaPayload,
    redirectTo,
  ) => {
    const { error } = await authClient.requestPasswordReset({
      email: normalizeEmail(email),
      redirectTo: redirectTo || getDefaultResetRedirectUrl(),
      fetchOptions: getCaptchaFetchOptions(captchaPayload),
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

    if (!error) {
      await syncSessionState();
    }

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
