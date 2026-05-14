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
import { Navigate, useLocation, useSearchParams } from 'react-router';

export default function SignupVerifyRoute() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const email = searchParams.get('email');
  const presetName =
    (location.state as { displayName?: string } | null)?.displayName ?? '';

  if (!email) {
    return <Navigate to="/signup/email" replace />;
  }

  return <SignupVerifyPage email={email} presetName={presetName} />;
}

function SignupVerifyPage({
  email,
  presetName,
}: {
  email: string;
  presetName: string;
}) {
  const { verifyEmailOtp } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const [displayName, setDisplayName] = useState(presetName);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ displayName?: string; otp?: string }>(
    {},
  );

  const handleSubmit = async () => {
    const nextErrors = {
      displayName: validateRequiredField(displayName, '请输入道号'),
      otp: validateRequiredField(otp, '请输入召符'),
    };
    setErrors(nextErrors);

    if (nextErrors.displayName || nextErrors.otp) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await verifyEmailOtp(email, otp, displayName);

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
      title="【建号验证】"
      lead="输入召符，完成缔结。"
      subtitle={`召符已发往 ${email}`}
      backHref={`/signup/email?email=${encodeURIComponent(email)}`}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton
            href={`/signup/email?email=${encodeURIComponent(email)}`}
            variant="ghost"
          >
            修改地址
          </InkButton>
          <InkButton href="/signup/password" variant="secondary">
            改为设置口令
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
            setErrors((current) => ({ ...current, otp: undefined }));
          }}
          placeholder="请输入 6 位召符"
          error={errors.otp}
          disabled={loading}
        />
        <InkInput
          label="道号"
          value={displayName}
          onChange={(value) => {
            setDisplayName(value);
            setErrors((current) => ({ ...current, displayName: undefined }));
          }}
          placeholder="例：青岚道友"
          error={errors.displayName}
          disabled={loading}
        />
        <InkButton
          type="submit"
          variant="primary"
          disabled={loading}
          className="w-full text-center"
        >
          {loading ? '缔结中…' : '完成缔结'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
