import {
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
  validatePasswordConfirmation,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

export default function ResetPasswordRoute() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');

  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  return <ResetPasswordPage resetToken={resetToken} />;
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
      password: validateRequiredField(password, '请输入新口令'),
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
        title: '口令已重设',
        message: '新口令已可使用，请重新归位。',
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
      title="【重设口令】"
      lead="设置新的口令。"
      backHref="/login/password"
      footer={
        <div className="flex items-center justify-center">
          <InkButton href="/login/password" variant="ghost">
            返回口令登录
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
          label="新口令"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder="请输入新口令"
          error={errors.password}
          disabled={loading}
        />
        <InkInput
          label="确认新口令"
          type="password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
          }}
          placeholder="请再次输入新口令"
          error={errors.confirmPassword}
          disabled={loading}
        />
        <InkButton
          type="submit"
          variant="primary"
          disabled={loading}
          className="w-full text-center"
        >
          {loading ? '重设中…' : '确认重设'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
