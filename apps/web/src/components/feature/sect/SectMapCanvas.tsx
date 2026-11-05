import { InkButton } from '@app/components/ui/InkButton';
import { bodyFontFamily } from '@app/lib/fonts';
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  SectMapText,
  SectMapToolbar,
  type SectMapBackAction,
} from './SectMapChrome';
import type { SectMapController, SectMapView } from './SectPhaserRuntime';

interface SectMapCanvasProps {
  title: string;
  backAction: SectMapBackAction;
  image: string;
  alt: string;
  aspectRatio: number;
  view: SectMapView;
  controller: RefObject<SectMapController | null>;
  fallback: ReactNode;
  onSelect(id: string): void;
  onClear(): void;
  onOpenDirectory(trigger: HTMLButtonElement): void;
  onError(): void;
}

const mapControlClass =
  'text-ink-secondary hover:text-crimson focus-visible:outline-crimson flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px]';

export function SectMapCanvas({
  title,
  backAction,
  image,
  alt,
  aspectRatio,
  view,
  controller,
  fallback,
  onSelect,
  onClear,
  onOpenDirectory,
  onError,
}: SectMapCanvasProps) {
  const root = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gestureHintVisible, setGestureHintVisible] = useState(true);
  const fontText = view.markers.map(({ label }) => label).join('');
  const readView = useEffectEvent(() => view);
  const select = useEffectEvent(onSelect);
  const clear = useEffectEvent(onClear);
  const closeDirectoryOnError = useEffectEvent(onError);

  useEffect(() => {
    let disposed = false;
    let failed = false;
    let instance: SectMapController | undefined;
    const fail = (message: string) => {
      if (disposed || failed) return;
      failed = true;
      window.clearTimeout(timer);
      controller.current = null;
      instance?.destroy();
      instance = undefined;
      closeDirectoryOnError();
      setError(message);
    };
    const timer = window.setTimeout(() => fail('宗门舆图加载超时。'), 15000);

    void Promise.all([
      import('./SectPhaserRuntime'),
      document.fonts.load(`16px "${bodyFontFamily}"`, fontText).catch(() => []),
    ])
      .then(([runtime]) => {
        if (disposed || failed || !root.current) return;
        const canvas = runtime.attachSectPhaser({
          root: root.current,
          image,
          aspectRatio,
          ariaLabel: `${alt}。方向键切换设施，回车查看。`,
          view: readView(),
          onSelect: (id) => select(id),
          onClear: () => clear(),
          onInteract: () => setGestureHintVisible(false),
          onReady: () => {
            if (disposed || failed) return;
            window.clearTimeout(timer);
            setReady(true);
          },
          onError: fail,
        });
        if (failed) {
          canvas.destroy();
          return;
        }
        instance = canvas;
        controller.current = instance;
        const selectedId = readView().selectedId;
        if (selectedId) instance.focus(selectedId);
      })
      .catch(() => fail('宗门舆图暂时无法打开。'));
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.current = null;
      instance?.destroy();
    };
  }, [alt, aspectRatio, attempt, controller, fontText, image]);

  useEffect(() => {
    controller.current?.setView(view);
  }, [controller, view]);

  const retry = () => {
    setReady(false);
    setError(null);
    setAttempt((value) => value + 1);
  };

  if (error) {
    return (
      <>
        <SectMapToolbar title={title} backAction={backAction} />
        <SectMapText>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p role="status" className="text-ink-secondary text-sm">
              {error}
            </p>
            <InkButton onClick={retry} variant="secondary">
              重试舆图
            </InkButton>
          </div>
          {fallback}
        </SectMapText>
      </>
    );
  }

  return (
    <>
      <SectMapToolbar
        title={title}
        backAction={backAction}
        mapMode="atlas"
        onOpenDirectory={onOpenDirectory}
      />
      <div ref={root} className="absolute inset-0 overflow-hidden" />
      {!ready ? (
        <p
          role="status"
          className="text-ink-secondary pointer-events-none absolute inset-0 flex items-center justify-center text-sm"
        >
          宗门舆图展开中……
        </p>
      ) : null}
      {ready ? (
        <div
          role="group"
          aria-label="舆图视野"
          className="border-ink/15 divide-ink/10 bg-paper/95 absolute right-[max(env(safe-area-inset-right),0.75rem)] bottom-[max(env(safe-area-inset-bottom),0.75rem)] z-20 flex divide-x rounded-sm border text-xl shadow-sm backdrop-blur-sm"
        >
          <button
            type="button"
            className={mapControlClass}
            aria-label="缩小宗门舆图"
            onClick={() => controller.current?.zoomOut()}
          >
            −
          </button>
          <button
            type="button"
            className={mapControlClass}
            aria-label="放大宗门舆图"
            onClick={() => controller.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            className={mapControlClass}
            aria-label="复位宗门舆图"
            onClick={() => controller.current?.reset()}
          >
            ↺
          </button>
        </div>
      ) : null}
      {ready && gestureHintVisible && !view.selectedId ? (
        <p className="bg-paper/95 text-ink-secondary pointer-events-none absolute bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-[max(env(safe-area-inset-left),0.75rem)] max-w-[calc(100%-10rem)] px-2 py-1.5 text-xs md:hidden">
          单指拖动 · 双指缩放
        </p>
      ) : null}
    </>
  );
}
