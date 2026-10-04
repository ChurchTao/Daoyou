import {
  AuthChoiceCard,
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
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
        '登录失败',
      );
    }
  };

  return (
    <AuthPageShell
      title="【注册】"
      lead="选择一种注册方式。"
      footer={
        <div className="flex items-center justify-center gap-2">
          <span className="text-ink-secondary">已有账号？</span>
          <InkButton href="/login" variant="primary">
            去登录
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3">
        <AuthChoiceCard
          href="/login/email?source=signup"
          title="邮箱验证码"
          description="通过邮箱验证码注册，验证后会自动登录。"
          accent="primary"
        />
        <AuthChoiceCard
          href="/signup/password"
          title="密码注册"
          description="使用邮箱、昵称和密码创建账号，并通过验证邮件激活。"
        />
        <AuthChoiceCard
          onClick={handleGitHubSignIn}
          disabled={loading}
          title={loading ? 'GitHub 登录中……' : 'GitHub 登录'}
          description="已有 GitHub 账号时可直接登录并创建账号。"
        />
      </div>
    </AuthPageShell>
  );
}
