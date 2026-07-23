import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import type { SectLandmark } from '@shared/lib/game/mapSystem';
import type { MapNodeDetailAction } from './MapNodeDetail';

export interface SectLandmarkDetailProps {
  landmark: SectLandmark;
  actions: MapNodeDetailAction[];
  onClose(): void;
}

export function SectLandmarkDetail({
  landmark,
  actions,
  onClose,
}: SectLandmarkDetailProps) {
  return (
    <div className="bg-background absolute right-4 bottom-16 left-4 z-40 md:right-8 md:left-auto md:w-96">
      <div className="p-3">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="text-crimson text-xs tracking-[0.18em]">四大宗门</p>
            <h2 className="mt-1 text-xl font-bold">{landmark.name}</h2>
          </div>
          <InkButton variant="ghost" className="p-0!" onClick={onClose}>
            ×
          </InkButton>
        </div>

        <p className="text-ink-secondary mb-4 text-sm leading-relaxed">
          {landmark.description}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {landmark.tags.map((tag) => (
            <InkTag
              key={tag}
              tone="neutral"
              variant="outline"
              className="text-xs"
            >
              {tag}
            </InkTag>
          ))}
        </div>

        <div className="flex gap-2">
          {actions.map((action) => (
            <InkButton
              key={action.key}
              variant={action.variant ?? 'secondary'}
              className="w-full justify-center"
              onClick={action.onClick}
            >
              {action.label}
            </InkButton>
          ))}
        </div>
      </div>
    </div>
  );
}
