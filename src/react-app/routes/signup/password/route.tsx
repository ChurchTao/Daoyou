import {
  AuthPageShell,
  AuthCaptchaField,
  buildEmailOtpTarget,
  toErrorMessage,
  useAuthFeedback,
  useCaptchaField,
  validateEmailField,
  validatePasswordConfirmation,
  validateRequiredField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function SignupPasswordRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signUpWithPassword } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const {
    captchaRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaPayload,
  } = useCaptchaField();

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
      displayName: validateRequiredField(displayName, '请输入昵称'),
      email: validateEmailField(email),
      password: validateRequiredField(password, '请输入密码'),
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

      const loginParams = new URLSearchParams({
        email: email.trim(),
        verification: 'sent',
      });
      navigate(`/login/password?${loginParams.toString()}`, { replace: true });
    } catch (error) {
      showErrorDialog(
        toErrorMessage(error as AuthActionError, '注册失败，请稍后重试'),
        '注册失败',
      );
    } finally {
      resetCaptcha();
      setLoading(false);
    }
  };

  return (
    <AuthPageShell
      title="【密码注册】"
      lead="使用邮箱、昵称和密码创建账号，注册后需验证邮箱。"
      backHref="/signup"
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton
            href={buildEmailOtpTarget('/login/email', {
              email,
              displayName,
              source: 'signup',
            })}
            variant="ghost"
          >
            改为邮箱验证码
          </InkButton>
          <InkButton href="/login" variant="secondary">
            已有账号，去登录
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
          label="昵称"
          value={displayName}
          onChange={(value) => {
            setDisplayName(value);
            setErrors((current) => ({ ...current, displayName: undefined }));
          }}
          placeholder="例：青岚"
          error={errors.displayName}
          disabled={loading}
        />
        <InkInput
          label="邮箱"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setErrors((current) => ({ ...current, email: undefined }));
          }}
          placeholder="例：player@example.com"
          error={errors.email}
          disabled={loading}
        />
        <InkInput
          label="密码"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          placeholder="请设置密码"
          error={errors.password}
          disabled={loading}
        />
        <InkInput
          label="确认密码"
          type="password"
          value={confirmPassword}
          onChange={(value) => {
            setConfirmPassword(value);
            setErrors((current) => ({
              ...current,
              confirmPassword: undefined,
            }));
          }}
          placeholder="请再次输入密码"
          error={errors.confirmPassword}
          disabled={loading}
        />
        <AuthCaptchaField
          action="sign-up"
          error={captchaError}
          captchaRef={captchaRef}
          onPayloadChange={setCaptchaPayload}
        />
        <InkButton
          type="submit"
          variant="primary"
          pending={loading}
          pendingLabel="注册中……"
          className="w-full text-center"
        >
          注册并发送验证邮件
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
