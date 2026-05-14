import {
  AuthPageShell,
  AuthTurnstileField,
  toErrorMessage,
  useAuthFeedback,
  useTurnstileField,
  validateEmailField,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function LoginPasswordRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithPassword } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const {
    turnstileEnabled,
    turnstileRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaToken,
  } = useTurnstileField();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  const handleSubmit = async () => {
    const nextErrors = {
      email: validateEmailField(email),
      password: validateRequiredField(password, '请输入口令'),
    };
    setErrors(nextErrors);

    if (nextErrors.email || nextErrors.password) {
      return;
    }

    const verifiedCaptchaToken = ensureCaptcha();
    if (verifiedCaptchaToken === null) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await signInWithPassword(
        email,
        password,
        verifiedCaptchaToken || undefined,
      );

      if (error) {
        throw error;
      }

      navigate('/game', { replace: true });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '登录失败，请稍后重试'),
        '归位失败',
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【口令归位】"
      lead="用邮箱与口令归位。"
      backHref="/login"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/forgot-password" variant="ghost">
            忘记口令
          </InkButton>
          <InkButton href="/login/email" variant="secondary">
            改用邮箱口令
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
          label="飞鸽传书地址"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          placeholder="例：daoyou@xiuxian.com"
          error={errors.email}
          disabled={loading}
        />
        <InkInput
          label="口令"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder="请输入口令"
          error={errors.password}
          disabled={loading}
        />
        <AuthTurnstileField
          enabled={turnstileEnabled}
          error={captchaError}
          turnstileRef={turnstileRef}
          onTokenChange={setCaptchaToken}
        />
        <InkButton
          type="submit"
          variant="primary"
          disabled={loading}
          className="w-full text-center"
        >
          {loading ? '归位中…' : '立即归位'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
