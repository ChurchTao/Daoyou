import {
  AuthPageShell,
  toErrorMessage,
  useAuthFeedback,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

export default function LoginVerifyRoute() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email');

  if (!email) {
    return <Navigate to="/login/email" replace />;
  }

  return <LoginVerifyPage email={email} />;
}

function LoginVerifyPage({ email }: { email: string }) {
  const { verifyEmailOtp } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ otp?: string }>({});

  const handleSubmit = async () => {
    const otpError = validateRequiredField(otp, '请输入召符');
    setErrors({ otp: otpError });

    if (otpError) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await verifyEmailOtp(email, otp);

      if (error) {
        throw error;
      }
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '召符有误或已失效'),
        '验证失败',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【口令验证】"
      lead="输入召符，完成归位。"
      subtitle={`召符已发往 ${email}`}
      backHref={`/login/email?email=${encodeURIComponent(email)}`}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton
            href={`/login/email?email=${encodeURIComponent(email)}`}
            variant="ghost"
          >
            修改地址
          </InkButton>
          <InkButton href="/login/password" variant="secondary">
            改用口令登录
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
          label="召符"
          value={otp}
          onChange={(value) => {
            setOtp(value);
            setErrors({ otp: undefined });
          }}
          placeholder="请输入 6 位召符"
          error={errors.otp}
          disabled={loading}
        />
        <InkButton
          type="submit"
          variant="primary"
          disabled={loading}
          className="w-full text-center"
        >
          {loading ? '验证中…' : '完成归位'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
