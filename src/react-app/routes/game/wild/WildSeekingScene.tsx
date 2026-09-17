import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import type { WildRegionView } from '@shared/contracts/combatV6Wild';
import { BEAST_SPECIES } from '@shared/engine/combat-v6/beasts/content';
import { getMapNode } from '@shared/lib/game/mapSystem';
import './wild-seeking.css';

export function WildSeekingScene({
  region,
  searching,
  starting,
  unavailable,
  qi,
  onSearch,
  onStart,
  ownerLevel,
}: {
  region: WildRegionView;
  searching: boolean;
  starting: boolean;
  unavailable: boolean;
  qi: number | null;
  onSearch: () => void;
  onStart: () => void;
  ownerLevel: number | null;
}) {
  const encounter = region.encounter;
  const cubs = encounter?.combatants.filter((c) => c.level === 0).length ?? 0;
  const location = getMapNode(region.nodeId);
  const parent =
    location && 'parent_id' in location ? getMapNode(location.parent_id) : null;
  const insufficient = qi !== null && qi < region.qiCost;
  return (
    <div className="wild-seeking-scene mx-auto w-full px-4 sm:px-8">
      <header className="wild-seeking-header px-2 text-center">
        <p className="text-ink-secondary text-xs tracking-widest">
          {parent?.name ?? '山野'} · 野外
        </p>
        <h1 className="font-heading text-ink mt-3 text-3xl tracking-widest md:text-4xl">
          {region.name}
        </h1>
        <p className="text-ink-secondary mx-auto mt-4 max-w-lg text-sm leading-7">
          {region.description}
        </p>
      </header>
      <section
        className="wild-seeking-stage relative isolate flex flex-col justify-center"
        aria-label="本次寻觅"
        aria-busy={searching}
      >
        <WildLandscape scenery={region.scenery} />
        <div className="relative z-10 w-full py-8">
          {searching ? (
            <GameLoadingState
              variant="inline"
              immediate
              message={region.searchText}
            />
          ) : encounter ? (
            <div key={encounter.id} className="wild-seeking-result">
              <div className="text-ink-secondary mb-7 flex items-baseline justify-center gap-2 text-sm">
                <span>发现灵兽</span>
                <span className="text-ink-secondary font-mono text-xs">
                  {encounter.combatants.length} 只
                </span>
              </div>
              <ul
                className="wild-seeking-roster flex justify-center"
                aria-label="本次发现的灵兽"
              >
                {encounter.combatants.map((c) => (
                  <li
                    key={c.unitId}
                    className="wild-seeking-beast flex min-w-0 flex-col items-center text-center"
                  >
                    <div
                      className={
                        c.level === 0
                          ? 'wild-seeking-portrait wild-seeking-portrait-cub'
                          : 'wild-seeking-portrait'
                      }
                    >
                      <BeastIcon
                        speciesId={c.speciesId}
                        className="wild-seeking-beast-icon"
                      />
                    </div>
                    <span className="mt-4 text-sm md:text-base">
                      {BEAST_SPECIES.find((s) => s.id === c.speciesId)?.name ??
                        '灵兽'}
                    </span>
                    <span className="text-ink-secondary mt-1 flex items-center gap-1 text-xs">
                      <span className="font-mono">{c.level}级</span>
                      {c.level === 0 ? (
                        <InkTag tone="info">幼崽</InkTag>
                      ) : (
                        <span>成年</span>
                      )}
                    </span>
                    <span className="text-ink-secondary mt-1 min-h-4 text-xs">
                      {ownerLevel !== null && c.level > ownerLevel
                        ? '暂不可出战'
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
              <p
                className="text-ink-secondary mx-auto mt-8 max-w-md text-center text-sm leading-6"
                role="status"
              >
                {cubs
                  ? '那道小小的身影，是尚未长成的幼崽。'
                  : '灵兽的身影渐渐清晰，你已看清眼前的动静。'}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <GameIcon
                value={SCENERY_ICONS[region.scenery]}
                className="text-5xl"
              />
              <p className="mt-6 text-sm md:text-base">
                四下渐静，似有灵兽出没。
              </p>
              <p className="text-ink-secondary mt-2 text-xs">
                静下心来，寻一寻它们的踪迹。
              </p>
            </div>
          )}
        </div>
      </section>
      <div className="wild-seeking-actions text-center">
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <InkButton
            variant={encounter ? 'secondary' : 'primary'}
            pending={searching}
            pendingLabel="正在寻觅……"
            disabled={unavailable || starting || insufficient || qi === null}
            className="min-h-11 px-4"
            onClick={onSearch}
          >
            {encounter ? '继续寻觅' : '寻觅灵兽'}
          </InkButton>
          {encounter && !searching && (
            <InkButton
              variant="primary"
              pending={starting}
              pendingLabel="正在开战……"
              disabled={unavailable}
              className="min-h-11 px-4"
              onClick={onStart}
            >
              开战捕捉
            </InkButton>
          )}
        </div>
        <p className="text-ink-secondary mt-3 text-xs leading-6">
          每次寻觅消耗 <span className="font-mono">{region.qiCost}</span>{' '}
          点天地灵气
          {qi !== null && (
            <>
              {' '}
              · 当前 <span className="font-mono">{qi}</span>
            </>
          )}
        </p>
        <div className="mt-1 min-h-10">
          {insufficient && (
            <p className="text-crimson mt-1 text-xs" role="status">
              天地灵气不足，待自然恢复或补充后再寻觅。
            </p>
          )}
          {encounter && !searching && (
            <p className="text-ink-secondary mt-1 text-xs">
              继续寻觅将离开当前这组灵兽。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const SCENERY_ICONS: Record<WildRegionView['scenery'], string> = {
  meadow: '🌾',
  mine: '🪨',
  volcanic: '🔥',
  lake: '🌙',
  stone: '🪨',
  river: '💧',
  forest: '🌿',
  cave: '🦋',
  storm: '☁️',
};

function WildLandscape({ scenery }: { scenery: WildRegionView['scenery'] }) {
  const underground = scenery === 'mine' || scenery === 'cave';
  const water = scenery === 'meadow' || scenery === 'river';
  return (
    <div
      className="wild-seeking-landscape pointer-events-none absolute inset-0 -z-10"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        fill="none"
      >
        <g
          className={
            underground || scenery === 'stone'
              ? 'text-ink/10'
              : scenery === 'volcanic'
                ? 'text-wood/10'
                : 'text-teal/10'
          }
          fill="currentColor"
        >
          {!underground && (
            <path d="M0 260 80 210 150 234 265 114 360 202 443 162 550 268 664 201 746 240 863 126 936 196 1028 145 1200 255V600H0Z" />
          )}
          <path d="M0 322Q126 233 270 309T540 351Q728 286 857 321T1200 281V600H0Z" />
          <path d="M0 408Q192 337 394 403T749 417Q946 340 1200 398V600H0Z" />
        </g>
        {water && (
          <path
            className="text-paper"
            fill="currentColor"
            d="M715 324Q547 378 697 411T661 490Q586 533 728 600H928Q674 527 778 482T760 401Q605 371 735 324Z"
          />
        )}
        {scenery === 'lake' && (
          <g className="text-paper" fill="currentColor">
            <ellipse cx="600" cy="444" rx="460" ry="104" />
            <circle cx="850" cy="130" r="42" />
          </g>
        )}
        {underground && (
          <path
            className="text-ink/10"
            fill="currentColor"
            d="M0 0H1200V460L1050 325 1090 180 930 230 850 115 675 160 520 90 360 165 220 130 140 280 200 460 0 520Z"
          />
        )}
        {scenery === 'forest' && (
          <g className="text-teal/10" fill="currentColor">
            <path d="M110 600 135 80H190L180 600ZM1030 600 1010 80H1060L1100 600Z" />
            <ellipse cx="190" cy="120" rx="300" ry="110" />
            <ellipse cx="1030" cy="140" rx="320" ry="130" />
            <path d="M230 80Q140 310 260 450L245 453Q125 310 215 80ZM950 80Q1080 310 950 470L962 478Q1100 310 965 80Z" />
          </g>
        )}
        {scenery === 'stone' && (
          <path
            className="text-ink/10"
            fill="currentColor"
            d="M120 550 170 380 260 400 290 550ZM870 560 910 355 990 380 1040 560ZM380 565 410 460 470 485 480 565Z"
          />
        )}
        {scenery === 'volcanic' && (
          <path
            className="text-crimson/20"
            stroke="currentColor"
            strokeWidth="6"
            d="M210 580 330 485 280 440 430 360M1050 565 920 490 1000 445 875 360"
          />
        )}
        {scenery === 'storm' && (
          <g className="text-ink/10">
            <path
              fill="currentColor"
              d="M0 180Q130 70 300 150Q410 60 540 155Q720 70 900 150Q1070 60 1200 180V240H0Z"
            />
            <path
              stroke="currentColor"
              strokeWidth="5"
              d="M880 160 830 250H875L815 345"
            />
          </g>
        )}
        {scenery === 'cave' && (
          <g className="text-teal/30" fill="currentColor">
            <circle cx="220" cy="360" r="4" />
            <circle cx="940" cy="430" r="3" />
            <circle cx="1000" cy="310" r="5" />
          </g>
        )}
      </svg>
    </div>
  );
}
