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

export default function SignupEmailRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithEmailOtp } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const {
    turnstileEnabled,
    turnstileRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaToken,
  } = useTurnstileField();

  const [displayName, setDisplayName] = useState(
    searchParams.get('name') ?? '',
  );
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
  }>({});

  const handleSubmit = async () => {
    const nextErrors = {
      displayName: validateRequiredField(displayName, '请输入道号'),
      email: validateEmailField(email),
    };
    setErrors(nextErrors);

    if (nextErrors.displayName || nextErrors.email) {
      return;
    }

    const verifiedCaptchaToken = ensureCaptcha();
    if (verifiedCaptchaToken === null) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await signInWithEmailOtp(
        email,
        verifiedCaptchaToken || undefined,
      );

      if (error) {
        throw error;
      }

      navigate(`/signup/verify?email=${encodeURIComponent(email.trim())}`, {
        state: { displayName: displayName.trim() },
      });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '发送失败，请稍后重试'),
        '发送失败',
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【邮箱建号】"
      lead="留下邮箱与道号，领取建号召符。"
      backHref="/signup"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/signup/password" variant="ghost">
            改为设置口令
          </InkButton>
          <InkButton href="/login" variant="secondary">
            我已有真身
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
          {loading ? '发送中…' : '发送召符'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
