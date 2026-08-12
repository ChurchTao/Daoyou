import { resolveApiUrl } from '@app/lib/api/url';
import 'altcha';
import 'altcha/i18n/zh-cn';
import 'altcha/types/react';
import type { AltchaWidgetElement } from 'altcha';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type HTMLAttributes,
} from 'react';

export type AltchaAction =
  | 'sign-in'
  | 'sign-up'
  | 'password-reset'
  | 'email-otp';

export interface AltchaCaptchaHandle {
  reset: () => void;
}

interface AltchaCaptchaProps extends HTMLAttributes<HTMLDivElement> {
  action: AltchaAction;
  onPayloadChange: (payload: string | null) => void;
}

type AltchaStateChangeDetail = {
  payload?: string;
  state?: string;
};

const AltchaCaptcha = forwardRef<AltchaCaptchaHandle, AltchaCaptchaProps>(
  ({ action, onPayloadChange, className, ...rest }, ref) => {
    const widgetRef = useRef<AltchaWidgetElement | null>(null);
    const challengeUrl = useMemo(
      () =>
        resolveApiUrl(
          `/api/captcha/challenge?action=${encodeURIComponent(action)}`,
        ),
      [action],
    );

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          widgetRef.current?.reset();
          onPayloadChange(null);
        },
      }),
      [onPayloadChange],
    );

    useEffect(() => {
      const widget = widgetRef.current;
      if (!widget) {
        return;
      }

      const handleStateChange = (event: Event) => {
        const { payload, state } = (
          event as CustomEvent<AltchaStateChangeDetail>
        ).detail;
        onPayloadChange(state === 'verified' && payload ? payload : null);
      };

      widget.addEventListener('statechange', handleStateChange);
      return () => {
        widget.removeEventListener('statechange', handleStateChange);
      };
    }, [onPayloadChange]);

    return (
      <div className={className} {...rest}>
        <altcha-widget
          ref={widgetRef}
          auto="off"
          challenge={challengeUrl}
          language="zh-cn"
          style={{ '--altcha-max-width': '100%' }}
        />
      </div>
    );
  },
);

AltchaCaptcha.displayName = 'AltchaCaptcha';

export default AltchaCaptcha;
