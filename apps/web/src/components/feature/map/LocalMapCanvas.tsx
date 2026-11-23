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
  LocalMapText,
  LocalMapToolbar,
  type LocalMapBackAction,
} from './LocalMapChrome';
import type { LocalMapController, LocalMapView } from './LocalMapRuntime';
import { MapCanvasSurface } from './MapCanvasSurface';

interface LocalMapCanvasProps {
  title: string;
  backAction: LocalMapBackAction;
  image: string;
  alt: string;
  aspectRatio: number;
  mapLabel?: string;
  directoryLabel?: string;
  entryMarkerId?: string;
  status?: ReactNode;
  view: LocalMapView;
  controller: RefObject<LocalMapController | null>;
  fallback: ReactNode;
  onSelect(id: string): void;
  onClear(): void;
  onOpenDirectory(trigger: HTMLButtonElement): void;
  onError(): void;
}

const mapControlClass =
  'text-ink-secondary hover:text-crimson focus-visible:outline-crimson flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-2px]';

export function LocalMapCanvas({
  title,
  backAction,
  image,
  alt,
  aspectRatio,
  mapLabel = '宗门舆图',
  directoryLabel,
  entryMarkerId,
  status,
  view,
  controller,
  fallback,
  onSelect,
  onClear,
  onOpenDirectory,
  onError,
}: LocalMapCanvasProps) {
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
    let instance: LocalMapController | undefined;
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
    const timer = window.setTimeout(() => fail(`${mapLabel}加载超时。`), 15000);

    void Promise.all([
      import('./LocalMapRuntime'),
      document.fonts.load(`16px "${bodyFontFamily}"`, fontText).catch(() => []),
    ])
      .then(([runtime]) => {
        if (disposed || failed || !root.current) return;
        const canvas = runtime.attachLocalMap({
          root: root.current,
          image,
          aspectRatio,
          entryMarkerId,
          ariaLabel: `${alt} 方向键切换地点，回车查看。`,
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
      })
      .catch(() => fail(`${mapLabel}暂时无法打开。`));
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      controller.current = null;
      instance?.destroy();
    };
  }, [
    alt,
    aspectRatio,
    attempt,
    controller,
    entryMarkerId,
    fontText,
    image,
    mapLabel,
  ]);

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
        <LocalMapToolbar title={title} backAction={backAction} />
        <LocalMapText>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p role="status" className="text-ink-secondary text-sm">
              {error}
            </p>
            <InkButton onClick={retry} variant="secondary">
              重试舆图
            </InkButton>
          </div>
          {!view.blocked ? status : null}
          {fallback}
        </LocalMapText>
      </>
    );
  }

  return (
    <>
      <LocalMapToolbar
        title={title}
        backAction={backAction}
        mapMode="atlas"
        directoryLabel={directoryLabel}
        onOpenDirectory={onOpenDirectory}
      />
      <MapCanvasSurface root={root} image={image} />
      {status && !view.blocked ? (
        <div className="pointer-events-none absolute inset-x-3 top-[calc(var(--app-safe-top)+4rem)] z-10 mx-auto max-w-[36rem]">
          {status}
        </div>
      ) : null}
      {!ready ? (
        <p
          role="status"
          className="bg-paper/95 text-ink-secondary pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm px-3 py-2 text-sm"
        >
          {mapLabel}展开中……
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
            aria-label={`缩小${mapLabel}`}
            onClick={() => controller.current?.zoomOut()}
          >
            −
          </button>
          <button
            type="button"
            className={mapControlClass}
            aria-label={`放大${mapLabel}`}
            onClick={() => controller.current?.zoomIn()}
          >
            +
          </button>
          <button
            type="button"
            className={mapControlClass}
            aria-label={`复位${mapLabel}`}
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
