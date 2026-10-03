import {
  AuthChoiceCard,
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

export default function LoginRoute() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');

  if (resetToken) {
    return (
      <Navigate
        to={`/reset-password?token=${encodeURIComponent(resetToken)}`}
        replace
      />
    );
  }

  return <LoginChoicePage />;
}

function LoginChoicePage() {
  const { signInWithGitHub } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const [loading, setLoading] = useState(false);

  const handleGitHubSignIn = async () => {
    setLoading(true);

    try {
      const { error } = await signInWithGitHub('/game');

      if (error) {
        throw error;
      }
    } catch (error) {
      setLoading(false);
      showErrorDialog(
        toErrorMessage(error as AuthActionError, 'GitHub 登录失败'),
        '登录失败',
      );
    }
  };

  return (
    <AuthPageShell
      title="【登录】"
      lead="选择一种登录方式。"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-ink-secondary">还没有账号？</span>
          <InkButton href="/signup" variant="primary">
            去注册
          </InkButton>
          <span className="text-ink-secondary/50 px-1" aria-hidden="true">
            ·
          </span>
          <span className="text-ink-secondary">忘记密码？</span>
          <InkButton href="/forgot-password" variant="secondary">
            找回密码
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3">
        <AuthChoiceCard
          href="/login/email"
          title="邮箱验证码"
          description="通过邮箱验证码登录。首次使用该邮箱时会自动注册。"
          accent="primary"
        />
        <AuthChoiceCard
          href="/login/password"
          title="密码登录"
          description="使用邮箱和密码登录。"
        />
        <AuthChoiceCard
          onClick={handleGitHubSignIn}
          disabled={loading}
          title={loading ? 'GitHub 登录中……' : 'GitHub 登录'}
          description="已有 GitHub 账号时可直接登录。"
        />
      </div>
    </AuthPageShell>
  );
}
