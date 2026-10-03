import {
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
  validatePasswordConfirmation,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function ResetPasswordRoute() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');
  const resetError = searchParams.get('error');

  if (resetError || !resetToken) {
    return <InvalidResetLinkPage />;
  }

  return <ResetPasswordPage resetToken={resetToken} />;
}

function InvalidResetLinkPage() {
  return (
    <AuthPageShell
      title="【重设链接无效】"
      lead="该密码重设链接无效或已经过期，请重新发送一封重设邮件。"
      backHref="/login"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/forgot-password" variant="primary">
            重新发送
          </InkButton>
          <InkButton href="/login/password" variant="ghost">
            返回密码登录
          </InkButton>
        </div>
      }
    >
      <p role="alert" className="text-ink-secondary text-sm leading-6">
        为保护账号安全，密码重设链接只能使用一次，并会在有效期结束后失效。
      </p>
    </AuthPageShell>
  );
}

function ResetPasswordPage({ resetToken }: { resetToken: string }) {
  const navigate = useNavigate();
  const { resetPassword } = useAuth();
  const { showDialog, showErrorDialog } = useAuthFeedback();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async () => {
    const nextErrors = {
      password: validateRequiredField(password, '请输入新密码'),
      confirmPassword: validatePasswordConfirmation(password, confirmPassword),
    };
    setErrors(nextErrors);

    if (nextErrors.password || nextErrors.confirmPassword) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await resetPassword(resetToken, password);

      if (error) {
        throw error;
      }

      showDialog({
        title: '密码已重置',
        message: '新密码已生效，请重新登录。',
        confirmLabel: '去登录',
        onConfirm: () => navigate('/login/password', { replace: true }),
      });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '重设失败，请稍后重试'),
        '重设失败',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【重设密码】"
      lead="设置新密码。"
      backHref="/login/password"
      footer={
        <div className="flex items-center justify-center">
          <InkButton href="/login/password" variant="ghost">
            返回密码登录
          </InkButton>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <InkInput
          label="新密码"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder="请输入新密码"
          error={errors.password}
          disabled={loading}
        />
        <InkInput
          label="确认新密码"
          type="password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
          }}
          placeholder="请再次输入新密码"
          error={errors.confirmPassword}
          disabled={loading}
        />
        <InkButton
          type="submit"
          variant="primary"
          pending={loading}
          pendingLabel="重设中……"
          className="w-full text-center"
        >
          确认重设
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
