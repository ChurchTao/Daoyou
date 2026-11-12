import { GameImage } from '@app/components/ui/GameImage';
import {
  SPIRIT_GARDEN_BEAST_RECOVERY_MS,
  SPIRIT_GARDEN_PEST_RECOVERY_MS,
} from '@daoyou/game-content/spirit-field/config';
import type {
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import {
  formatGardenDuration,
  gardenIncidentPresentation,
  gardenSeedName,
} from '../garden-presentation';
import { GARDEN_INCIDENT_ART } from './gardenIncidentArt';

interface GardenIncidentHistoryProps {
  plants: SpiritGardenPlantView[];
  species: SpiritGardenSpecies[];
  limit?: number;
}

const incidentDate = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function GardenIncidentHistory({
  plants,
  species,
  limit,
}: GardenIncidentHistoryProps) {
  const entries = plants
    .flatMap((plant) =>
      plant.incidents.map((incident) => ({ plant, incident })),
    )
    .sort((a, b) => b.incident.occurredAt - a.incident.occurredAt);
  const visible = limit === undefined ? entries : entries.slice(0, limit);
  if (!visible.length) return null;
  const hasPests = visible.some(({ incident }) => incident.kind === 'pests');
  const hasBeast = visible.some(({ incident }) => incident.kind === 'beast');

  return (
    <>
      <ol className="space-y-3 text-xs leading-6">
        {visible.map(({ plant, incident }) => {
          const plantSpecies = species.find(
            (entry) => entry.id === plant.speciesId,
          );
          if (!plantSpecies) return null;
          const presentation = gardenIncidentPresentation(
            incident,
            plantSpecies,
          );
          const description =
            incident.kind === 'mutation'
              ? presentation.description
              : incident.kind === 'pests'
                ? `${plantSpecies.name}遭遇虫害。`
                : plantSpecies.growthForm === 'fungus' ||
                    plantSpecies.growthForm === 'aquatic'
                  ? `灵兽偷吸了${plantSpecies.name}凝结的灵露。`
                  : `灵兽啃食了${plantSpecies.name}的嫩芽。`;
          return (
            <li
              key={`${plant.id}:${incident.productionDay}:${incident.kind}`}
              className="flow-root"
            >
              <GameImage
                src={GARDEN_INCIDENT_ART[incident.kind]}
                alt=""
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                className="float-left mr-3 mb-1 size-14 object-contain sm:size-16"
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span
                    className={
                      incident.kind === 'mutation' ? 'text-teal' : 'text-ink'
                    }
                  >
                    {presentation.label}
                  </span>
                  <time
                    dateTime={new Date(incident.occurredAt).toISOString()}
                    className="text-ink-secondary font-mono"
                  >
                    {incidentDate.format(incident.occurredAt)}
                  </time>
                </div>
                <p className="text-ink-secondary">{description}</p>
                {incident.seedSpeciesId ? (
                  <p className="text-teal">
                    灵兽留下了 <span className="font-mono">1</span> 枚
                    {
                      species.find(
                        (entry) => entry.id === incident.seedSpeciesId,
                      )?.quality
                    }
                    {gardenSeedName(incident.seedSpeciesId, species)}。
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {hasPests || hasBeast ? (
        <details className="text-ink-secondary mt-3 text-xs leading-6">
          <summary className="focus-visible:outline-crimson min-h-11 cursor-pointer content-center focus-visible:outline-2 focus-visible:outline-offset-2">
            恢复规则
          </summary>
          <div className="space-y-2 pb-2">
            <p>
              {hasPests ? (
                <>
                  虫害需恢复{' '}
                  <span className="font-mono">
                    {formatGardenDuration(SPIRIT_GARDEN_PEST_RECOVERY_MS)}
                  </span>
                  {hasBeast ? '；' : '。'}
                </>
              ) : null}
              {hasBeast ? (
                <>
                  灵兽偷吃需恢复{' '}
                  <span className="font-mono">
                    {formatGardenDuration(SPIRIT_GARDEN_BEAST_RECOVERY_MS)}
                  </span>
                  。
                </>
              ) : null}
              期间暂停生产，无需照料，不扣除已有收成。
            </p>
            <p>
              恢复期间照常消耗寿命。收成已满或灵植暂存时，恢复和寿命计时均暂停。
            </p>
          </div>
        </details>
      ) : null}
      {hasBeast ? (
        <details className="text-ink-secondary text-xs leading-6">
          <summary className="focus-visible:outline-crimson min-h-11 cursor-pointer content-center focus-visible:outline-2 focus-visible:outline-offset-2">
            灵兽遗种规则
          </summary>
          <p className="pb-2">
            灵兽偷吃后有 <span className="font-mono">10%</span> 概率留下灵种，
            凡品至神品的 <span className="font-mono">8</span> 个品质等概率，
            与本株品质无关；每株一生最多获得{' '}
            <span className="font-mono">1</span> 枚。
          </p>
        </details>
      ) : null}
    </>
  );
}
