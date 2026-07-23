import {
  attachSweepPhaser,
  type SweepPhaserController,
} from '@app/routes/game/sect/affairs/SweepPhaserRuntime';
import {
  isSweepDirection,
  SWEEP_RULES_VERSION,
  type SweepDirection,
  type SweepGameProgress,
} from '@shared/engine/sect';
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';

type ParentMessage = {
  type: 'sect-sweep:move' | 'sect-sweep:reset';
  sessionId: string;
  rulesVersion: number;
  direction?: SweepDirection;
};

type RuntimeData = SweepGameProgress | SweepDirection[] | string;

export default function SectSweepRuntimePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [search] = useSearchParams();
  const sessionId = search.get('sessionId') ?? '';
  const seed = search.get('seed') ?? '';
  const rulesVersion = Number(search.get('rulesVersion'));

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !sessionId || !seed || rulesVersion !== SWEEP_RULES_VERSION)
      return;
    const origin = window.location.origin;
    let controller: SweepPhaserController | undefined;
    const post = (type: string, data: RuntimeData) =>
      window.parent.postMessage(
        { type, sessionId, rulesVersion, data },
        origin,
      );
    const onMessage = (event: MessageEvent<ParentMessage>) => {
      if (
        event.origin !== origin ||
        event.source !== window.parent ||
        event.data?.sessionId !== sessionId ||
        event.data?.rulesVersion !== rulesVersion
      )
        return;
      if (event.data.type === 'sect-sweep:reset') {
        controller?.reset();
        return;
      }
      if (
        event.data.type === 'sect-sweep:move' &&
        isSweepDirection(event.data.direction)
      )
        controller?.move(event.data.direction);
    };
    window.addEventListener('message', onMessage);
    controller = attachSweepPhaser({
      root,
      seed,
      onState: (state) => post('sect-sweep:state', state),
      onSuccess: (moves) => post('sect-sweep:success', moves),
      onError: (message) => post('sect-sweep:error', message),
    });
    return () => {
      window.removeEventListener('message', onMessage);
      controller?.destroy();
      controller = undefined;
    };
  }, [rulesVersion, seed, sessionId]);

  return <div ref={rootRef} className="fixed inset-0 overflow-hidden bg-stone-900" />;
}
