import type {
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';
import {
  gardenIncidentPresentation,
  gardenSeedName,
} from '../garden-presentation';

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

  return (
    <ol className="space-y-3 text-xs leading-6">
      {visible.map(({ plant, incident }) => {
        const plantSpecies = species.find(
          (entry) => entry.id === plant.speciesId,
        );
        if (!plantSpecies) return null;
        const presentation = gardenIncidentPresentation(incident, plantSpecies);
        return (
          <li key={`${plant.id}:${incident.productionDay}:${incident.kind}`}>
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
            <p className="text-ink-secondary">{presentation.description}</p>
            {incident.seedSpeciesId ? (
              <p className="text-teal">
                灵兽留下了
                {
                  species.find((entry) => entry.id === incident.seedSpeciesId)
                    ?.quality
                }
                {gardenSeedName(incident.seedSpeciesId, species)}。
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
