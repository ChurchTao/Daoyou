import {
  AuthChoiceCard,
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
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
        '接引失败',
      );
    }
  };

  return (
    <AuthPageShell
      title="【入界】"
      lead="选择一种归位方式。"
      footer={
        <div className="flex items-center justify-center gap-2">
          <span className="text-ink-secondary">初次来此？</span>
          <InkButton href="/signup" variant="primary">
            创建真身
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3">
        <AuthChoiceCard
          href="/login/email"
          title="邮箱口令"
          description="领取一次性召符，直接归位。"
          accent="primary"
        />
        <AuthChoiceCard
          href="/login/password"
          title="密码登录"
          description="使用邮箱与口令归位。"
        />
        <AuthChoiceCard
          onClick={handleGitHubSignIn}
          disabled={loading}
          title={loading ? 'GitHub 接引中…' : 'GitHub 登录'}
          description="已有 GitHub 身份时可直接接引。"
        />
      </div>
    </AuthPageShell>
  );
}
