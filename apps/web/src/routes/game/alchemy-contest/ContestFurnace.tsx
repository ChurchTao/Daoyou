import { FurnaceGatherEffect } from '@app/components/feature/craft/FurnaceGatherEffect';
import { GameIcon } from '@app/components/ui/GameIcon';
import { useGameSettings } from '@app/lib/game-setting';
import type { ContestHeat } from '@daoyou/game-domain/alchemy/contest';
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { mountContestFurnace } from './FurnaceRuntime';
import { contestFurnacePositions } from './presentation';
const artwork = 'icon:xuanfire-furnace';

export function ContestFurnace({
  heat,
  occupied,
  firing,
  count,
  children,
}: {
  heat: ContestHeat;
  occupied: number;
  firing: boolean;
  count: number;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const runtime = useRef<ReturnType<typeof mountContestFurnace>>(null);
  const previous = useRef(count);
  const [ready, setReady] = useState(false);
  const { imageOpacity } = useGameSettings();

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let active = true;
    void import('./FurnaceRuntime')
      .then(({ mountContestFurnace }) => {
        if (!active) return;
        runtime.current = mountContestFurnace(
          element,
          GameIcon.resolveSource(artwork),
          () => {
            if (active) setReady(true);
          },
        );
      })
      .catch(() => {});
    return () => {
      active = false;
      runtime.current?.destroy();
      runtime.current = null;
    };
  }, []);

  useEffect(() => {
    runtime.current?.update(heat, firing, ready && previous.current !== count);
    if (ready) previous.current = count;
  }, [heat, firing, count, ready]);

  return (
    <div
      className="contest-furnace"
      data-heat={heat}
      data-firing={firing || undefined}
      data-ready={ready || undefined}
    >
      <div className="contest-furnace-rim" aria-hidden="true" />
      <GameIcon
        className="contest-furnace-fallback"
        value={artwork}
        purpose="artwork"
      />
      <div
        className="contest-furnace-canvas"
        data-ready={ready || undefined}
        aria-hidden="true"
        ref={root}
        style={{ '--furnace-art-opacity': imageOpacity } as CSSProperties}
      />
      {firing && (
        <FurnaceGatherEffect
          slots={contestFurnacePositions.map((_, index) => index < occupied)}
          positions={contestFurnacePositions}
        />
      )}
      {children}
    </div>
  );
}
