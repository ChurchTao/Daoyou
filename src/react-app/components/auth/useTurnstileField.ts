import { clientEnv } from '@app/lib/env';
import { useRef, useState } from 'react';
import type { TurnstileCaptchaHandle } from './TurnstileCaptcha';

export function useTurnstileField() {
  const turnstileEnabled = Boolean(clientEnv.turnstileSiteKey);
  const turnstileRef = useRef<TurnstileCaptchaHandle | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');

  const updateCaptchaToken = (token: string | null) => {
    setCaptchaToken(token);
    if (token) {
      setCaptchaError('');
    }
  };

  const ensureCaptcha = () => {
    if (!turnstileEnabled) {
      return '';
    }

    if (!captchaToken) {
      setCaptchaError('请先完成人机验证');
      return null;
    }

    setCaptchaError('');
    return captchaToken;
  };

  const resetCaptcha = () => {
    turnstileRef.current?.reset();
    setCaptchaError('');
  };

  return {
    turnstileEnabled,
    turnstileRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaError,
    setCaptchaToken: updateCaptchaToken,
  };
}
