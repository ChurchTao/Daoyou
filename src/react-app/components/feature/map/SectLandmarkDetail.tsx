import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
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
    <InkDetailDrawer
      isOpen
      onClose={onClose}
      title={landmark.name}
      description={
        <>
          <span className="text-crimson mb-1 block text-xs tracking-[0.18em]">
            四大宗门
          </span>
          {landmark.description}
        </>
      }
      size="sm"
      footer={
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
      }
    >
      <div className="flex flex-wrap gap-2">
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
    </InkDetailDrawer>
  );
}
