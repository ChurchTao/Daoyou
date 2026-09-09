import { ArtifactListCard } from '@app/components/feature/products';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton, InkList, InkNotice } from '@app/components/ui';
import type { Artifact } from '@shared/types/cultivator';
export function ArtifactsTab({
  artifacts,
  isLoading = false,
  onShowDetails,
}: {
  artifacts: Artifact[];
  isLoading?: boolean;
  onShowDetails(item: Artifact): void;
}) {
  if (isLoading)
    return <GameLoadingState message="正在读取历史装备……" variant="inline" />;
  if (!artifacts.length) return <InkNotice>暂无历史装备。</InkNotice>;
  return (
    <div className="space-y-3">
      <p className="text-ink-secondary text-sm">
        历史装备已停用，仅保留存档信息。
      </p>
      <InkList>
        {artifacts.map((item) => (
          <ArtifactListCard
            key={item.id ?? item.name}
            artifact={item}
            actions={
              <InkButton onClick={() => onShowDetails(item)}>详情</InkButton>
            }
          />
        ))}
      </InkList>
    </div>
  );
}
