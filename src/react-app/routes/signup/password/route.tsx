import {
  AuthPageShell,
  AuthTurnstileField,
  toErrorMessage,
  useAuthFeedback,
  useTurnstileField,
  validateEmailField,
  validatePasswordConfirmation,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/AuthContext';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

export default function SignupPasswordRoute() {
  const [searchParams] = useSearchParams();
  const { signUpWithPassword } = useAuth();
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const handleSubmit = async () => {
    const nextErrors = {
      displayName: validateRequiredField(displayName, '请输入道号'),
      email: validateEmailField(email),
      password: validateRequiredField(password, '请输入口令'),
      confirmPassword: validatePasswordConfirmation(password, confirmPassword),
    };
    setErrors(nextErrors);

    if (
      nextErrors.displayName ||
      nextErrors.email ||
      nextErrors.password ||
      nextErrors.confirmPassword
    ) {
      return;
    }

    const verifiedCaptchaToken = ensureCaptcha();
    if (verifiedCaptchaToken === null) {
      return;
    }

    setLoading(true);

    try {
      const { error } = await signUpWithPassword(
        displayName,
        email,
        password,
        verifiedCaptchaToken || undefined,
      );

      if (error) {
        throw error;
      }
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '注册失败，请稍后重试'),
        '缔结失败',
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【口令建号】"
      lead="设置邮箱、道号与口令。"
      backHref="/signup"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton href="/signup/email" variant="ghost">
            改为邮箱建号
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
        <InkInput
          label="口令"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder="请设置口令"
          error={errors.password}
          disabled={loading}
        />
        <InkInput
          label="确认口令"
          type="password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
          }}
          placeholder="请再次输入口令"
          error={errors.confirmPassword}
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
          {loading ? '缔结中…' : '完成建号'}
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
