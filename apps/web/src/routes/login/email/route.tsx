import {
  AuthCaptchaField,
  AuthPageShell,
  buildEmailOtpTarget,
  toErrorMessage,
  useAuthFeedback,
  useCaptchaField,
  validateEmailField,
} from '@app/components/auth';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { useAuth, type AuthActionError } from '@app/lib/auth/authContext';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

export default function LoginEmailRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithEmailOtp } = useAuth();
  const { showErrorDialog } = useAuthFeedback();
  const source = searchParams.get('source') === 'signup' ? 'signup' : 'login';
  const {
    captchaRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaPayload,
  } = useCaptchaField();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string }>({});

  const handleSubmit = async () => {
    const emailError = validateEmailField(email);
    setErrors({ email: emailError });

    if (emailError) {
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

      navigate(
        buildEmailOtpTarget('/login/verify', {
          email,
          source,
        }),
      );
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
      title="【邮箱验证码】"
      lead="输入邮箱获取验证码。首次使用该邮箱时，验证后会自动注册账号。"
      backHref={source === 'signup' ? '/signup' : '/login'}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <InkButton
            href={
              source === 'signup'
                ? buildEmailOtpTarget('/signup/password', {
                    email,
                  })
                : buildEmailOtpTarget('/login/password', { email })
            }
            variant="ghost"
          >
            {source === 'signup' ? '改为密码注册' : '改用密码登录'}
          </InkButton>
          <InkButton
            href={source === 'signup' ? '/login' : '/signup'}
            variant="secondary"
          >
            {source === 'signup' ? '已有账号，去登录' : '还没有账号？去注册'}
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
        <AuthCaptchaField
          action="email-otp"
          error={captchaError}
          captchaRef={captchaRef}
          onPayloadChange={setCaptchaPayload}
        />
        <InkButton
          type="submit"
          variant="primary"
          pending={loading}
          pendingLabel="发送中……"
          className="w-full text-center"
        >
          发送验证码
        </InkButton>
      </form>
    </AuthPageShell>
  );
}
