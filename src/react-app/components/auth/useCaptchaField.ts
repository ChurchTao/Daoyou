import { useCallback, useRef, useState } from 'react';
import type { AltchaCaptchaHandle } from './AltchaCaptcha';

export function useCaptchaField() {
  const captchaRef = useRef<AltchaCaptchaHandle | null>(null);
  const [captchaPayload, setCaptchaPayload] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');

  const updateCaptchaPayload = useCallback((payload: string | null) => {
    setCaptchaPayload(payload);
    if (payload) {
      setCaptchaError('');
    }
  }, []);

  const ensureCaptcha = () => {
    if (!captchaPayload) {
      setCaptchaError('请先完成人机验证');
      return null;
    }

    setCaptchaError('');
    return captchaPayload;
  };

  const resetCaptcha = () => {
    captchaRef.current?.reset();
    setCaptchaError('');
  };

  return {
    captchaRef,
    captchaError,
    ensureCaptcha,
    resetCaptcha,
    setCaptchaError,
    setCaptchaPayload: updateCaptchaPayload,
  };
}
