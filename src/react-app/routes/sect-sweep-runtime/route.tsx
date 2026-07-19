import {
  SWEEP_RULES_VERSION,
  type SweepGameState,
  type SweepInputSegment,
} from '@shared/engine/sect';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import {
  attachSweepLittleJs,
  setSweepVirtualInput,
} from '@app/routes/game/sect/affairs/SweepLittleJsRuntime';

type ParentMessage = {
  type: 'sect-sweep:input';
  sessionId: string;
  rulesVersion: number;
  direction: number | null;
  sweeping: boolean;
};

export default function SectSweepRuntimePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [search] = useSearchParams();
  const sessionId = search.get('sessionId') ?? '';
  const seed = search.get('seed') ?? '';
  const rulesVersion = Number(search.get('rulesVersion'));

  useEffect(() => {
    const root = rootRef.current;
    if (
      !root ||
      !sessionId ||
      !seed ||
      rulesVersion !== SWEEP_RULES_VERSION
    )
      return;
    const origin = window.location.origin;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    const post = (type: string, data: SweepGameState | SweepInputSegment[]) =>
      window.parent.postMessage(
        { type, sessionId, rulesVersion, data },
        origin,
      );
    const onMessage = (event: MessageEvent<ParentMessage>) => {
      if (
        event.origin !== origin ||
        event.source !== window.parent ||
        event.data?.type !== 'sect-sweep:input' ||
        event.data.sessionId !== sessionId ||
        event.data.rulesVersion !== rulesVersion
      )
        return;
      setSweepVirtualInput(event.data.direction, event.data.sweeping);
    };
    window.addEventListener('message', onMessage);
    void attachSweepLittleJs({
      root,
      seed,
      onState: (state) => post('sect-sweep:state', state),
      onSuccess: (trace) => post('sect-sweep:success', trace),
    }).then((cleanup) => {
      if (cancelled) cleanup();
      else dispose = cleanup;
    });
    return () => {
      cancelled = true;
      window.removeEventListener('message', onMessage);
      setSweepVirtualInput(null, false);
      dispose?.();
    };
  }, [rulesVersion, seed, sessionId]);

  return <div ref={rootRef} className="fixed inset-0 overflow-hidden bg-stone-900" />;
}
