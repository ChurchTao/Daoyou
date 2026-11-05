import {
  dungeonDifficultyColorMap,
  tierColorMap,
} from '@app/components/ui/InkBadge';
import { cn } from '@app/lib/cn';
import type { RealmType } from '@daoyou/constants/realms';
import { MYSTERY_CASE_KINDS } from '@daoyou/game-content/dungeon/case-kinds';
import { type MapNodeInfo } from '@daoyou/game-domain/world/map';
import {
  canChallengeDungeonRealm,
  resolveDungeonMapConfig,
} from '@daoyou/game-rules/world/dungeon';
import { mysterySceneUrl } from './components/mysteryArt';
import { ExorcismTrack } from './components/ExorcismRunStrip';
import {
  EXORCISM_LINEAGES,
  exorcismLineageForScene,
} from '@daoyou/game-content/dungeon/exorcism';

/**
 * 选定秘境的介绍：场景底图、此地总述、推荐境界与难度，以及此地可能遇到的案型。
 * 案型只写玩家进场前就该知道的事，不透露真相。
 */
export function MapNodeCard({
  node,
  playerRealm,
  mode = 'mystery',
}: {
  node: MapNodeInfo;
  playerRealm?: RealmType;
  mode?: 'mystery' | 'exorcism';
}) {
  const dungeonConfig = resolveDungeonMapConfig(node);
  const scenario = node.dungeon_config?.scenario;
  const sceneUrl = mysterySceneUrl(scenario?.scene);
  const lineage = EXORCISM_LINEAGES[exorcismLineageForScene(scenario?.scene)];
  const caseKinds = (scenario?.templates ?? []).flatMap(
    (id) => MYSTERY_CASE_KINDS[id] ?? [],
  );
  const isRealmEligible = playerRealm
    ? canChallengeDungeonRealm(playerRealm, node.realm_requirement)
    : true;

  return (
    <article className="space-y-5">
      <h2 className="font-heading text-ink text-2xl md:text-3xl">
        {node.name}
      </h2>
      {sceneUrl ? (
        // 与解谜正文同一取景：贴底、上缘渐隐；宽屏取 3:1，让开始按钮留在首屏。
        <div
          aria-hidden
          className={cn(
            'aspect-[2/1] [mask-image:linear-gradient(to_bottom,transparent,black_18%)] bg-cover bg-bottom',
            mode === 'exorcism' ? 'lg:aspect-[4/1]' : 'lg:aspect-[3/1]',
          )}
          style={{ backgroundImage: `url(${sceneUrl})` }}
        />
      ) : null}

      <div className="text-ink-secondary flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span>
          推荐境界{' '}
          <span
            className={cn(
              'font-semibold',
              tierColorMap[node.realm_requirement],
            )}
          >
            {node.realm_requirement}
          </span>
          {isRealmEligible ? null : (
            <span className="text-crimson ml-1">（境界不足）</span>
          )}
        </span>
        <span>
          难度{' '}
          <span
            className={cn(
              'font-semibold',
              dungeonDifficultyColorMap[dungeonConfig.difficultyTier],
            )}
          >
            {dungeonConfig.difficultyLabel}
          </span>
        </span>
      </div>

      <p className="leading-8">{scenario?.setting ?? node.description}</p>

      {mode === 'exorcism' ? (
        <section className="space-y-3">
          <h3 className="text-ink-secondary text-sm">此地盘踞的祟物</h3>
          <div className="border-crimson/40 border-l-2 pl-3 text-sm leading-7">
            <span className="text-crimson font-semibold">{lineage.name}</span>
            <span className="text-ink-secondary"> · {lineage.trait}</span>
          </div>
          <ExorcismTrack run={{ wins: 0 }} finished label="一局四场" />
        </section>
      ) : caseKinds.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-ink-secondary text-sm">此地可能遇到的案子</h3>
          <ul className="space-y-2">
            {caseKinds.map((kind) => (
              <li
                key={kind.name}
                className="border-ink/20 border-l-2 pl-3 text-sm leading-7"
              >
                <span className="font-semibold">{kind.name}</span>
                <span className="text-ink-secondary"> · {kind.pitch}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
