'use client';

import {
  Turnstile,
  type TurnstileInstance,
} from '@marsidev/react-turnstile';
import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
} from 'react';

export interface TurnstileCaptchaHandle {
  reset: () => void;
}

interface TurnstileCaptchaProps extends HTMLAttributes<HTMLDivElement> {
  onTokenChange: (token: string | null) => void;
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const TurnstileCaptcha = forwardRef<TurnstileCaptchaHandle, TurnstileCaptchaProps>(
  ({ onTokenChange, className, ...rest }, ref) => {
    const turnstileRef = useRef<TurnstileInstance>(undefined);

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          turnstileRef.current?.reset();
          onTokenChange(null);
        },
      }),
      [onTokenChange],
    );

    if (!siteKey) {
      return (
        <div
          className={className}
          {...rest}
        >
          <p className="text-sm text-red-600/80">
            缺少 NEXT_PUBLIC_TURNSTILE_SITE_KEY，无法加载人机验证。
          </p>
        </div>
      );
    }

    return (
      <div
        className={className}
        {...rest}
      >
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={(token) => {
            onTokenChange(token);
          }}
          onExpire={() => {
            onTokenChange(null);
          }}
          onError={() => {
            onTokenChange(null);
          }}
          options={{
            theme: 'light',
            language: 'zh-CN',
            size: 'flexible',
          }}
        />
      </div>
    );
  },
);

TurnstileCaptcha.displayName = 'TurnstileCaptcha';

export default TurnstileCaptcha;
