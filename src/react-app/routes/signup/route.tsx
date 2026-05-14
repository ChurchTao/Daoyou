import {
  AuthChoiceCard,
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
import { useState } from 'react';

export default function SignupRoute() {
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
      title="【缔结真身】"
      lead="选择一种建号方式。"
      footer={
        <div className="flex items-center justify-center gap-2">
          <span className="text-ink-secondary">已有真身？</span>
          <InkButton href="/login" variant="primary">
            前往登录
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3">
        <AuthChoiceCard
          href="/signup/email"
          title="邮箱口令"
          description="填写邮箱与道号，完成一次性建号。"
          accent="primary"
        />
        <AuthChoiceCard
          href="/signup/password"
          title="设置口令"
          description="以邮箱、道号与口令缔结真身。"
        />
        <AuthChoiceCard
          onClick={handleGitHubSignIn}
          disabled={loading}
          title={loading ? 'GitHub 接引中…' : 'GitHub 登录'}
          description="已有 GitHub 身份时可直接接引并建号。"
        />
      </div>
    </AuthPageShell>
  );
}
