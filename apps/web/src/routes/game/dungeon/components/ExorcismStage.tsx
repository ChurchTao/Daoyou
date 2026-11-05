import type { ExorcismRunState } from '@daoyou/game-domain/dungeon/exorcism';
import type { ReactNode } from 'react';
import './exorcism-stage.css';
import { ExorcismTrack } from './ExorcismRunStrip';
import { mysterySceneUrl } from './mysteryArt';

/** 局内场景的远景：贴底的淡墨插画。没有素材的地貌不显示。 */
function ExorcismScene({ scene }: { scene?: string }) {
  const url = mysterySceneUrl(scene);
  return url ? (
    <div
      aria-hidden
      className="exorcism-scene"
      style={{ backgroundImage: `url(${url})` }}
    />
  ) : null;
}

/** 迎战页和补给页共用的舞台：顶部地点与四场进度，下面是页面内容。 */
export function ExorcismStage({
  location,
  scene,
  run,
  children,
}: {
  location: string;
  scene?: string;
  run: Pick<ExorcismRunState, 'wins'>;
  children: ReactNode;
}) {
  return (
    <div className="exorcism-stage text-ink space-y-6">
      <ExorcismScene scene={scene} />
      <header className="border-battle-rule-strong flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-dashed pb-4">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl leading-tight md:text-3xl">
            {location}
          </h1>
          <p className="text-battle-muted mt-1 text-xs">云游·除祟</p>
        </div>
        <ExorcismTrack run={run} />
      </header>
      {children}
    </div>
  );
}
