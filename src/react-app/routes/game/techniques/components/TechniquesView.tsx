import {
  GameSceneAsideSection,
  GameSceneFrame,
  GameSceneNote,
} from '@app/components/game-shell';
import {
  AbilityDetailModal,
  AbilityListCard,
} from '@app/components/feature/products';
import {
  InkButton,
  InkNotice,
} from '@app/components/ui';

import { useTechniquesViewModel } from '../hooks/useTechniquesViewModel';

export function TechniquesView() {
  const {
    cultivator,
    techniques,
    isLoading,
    note,
    selectedTechnique,
    isModalOpen,
    openTechniqueDetail,
    closeTechniqueDetail,
    openForgetConfirm,
  } = useTechniquesViewModel();

  if (isLoading && !cultivator) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="loading-tip">功法卷轴徐徐展开……</p>
      </div>
    );
  }

  return (
    <GameSceneFrame
      variant="lite"
      title="【所修功法】"
      description="根基所系的功法都在此归档。这里强调数量、取舍与回藏经阁继续参悟，而不再沿用旧文书页壳。"
      headerMeta={
        note ? (
          <GameSceneNote>
            <p className="text-sm leading-7">{note}</p>
          </GameSceneNote>
        ) : undefined
      }
      aside={
        <>
          <GameSceneAsideSection title="道基摘要">
            <div className="space-y-2 text-sm leading-7">
              <p>已习功法：{techniques.length} 部</p>
              <p>建议先保留与当前流派相合的底层功法。</p>
            </div>
          </GameSceneAsideSection>
          <GameSceneAsideSection title="下一步" className="text-sm leading-7">
            <p>若功法稀缺，可先去问法寻卷；若想再造新法，则回藏经阁继续参悟。</p>
          </GameSceneAsideSection>
        </>
      }
    >
      {!cultivator ? (
        <InkNotice>还未觉醒道身，何谈功法？先去首页觉醒吧。</InkNotice>
      ) : techniques.length === 0 ? (
        <InkNotice>尚未参悟任何功法，前往藏经阁修行吧。</InkNotice>
      ) : (
        <>
          <div className="space-y-3">
            {techniques.map((t) => (
              <AbilityListCard
                key={t.id}
                product={t}
                actions={
                  <div className="flex gap-2">
                    <InkButton variant="secondary" onClick={() => openTechniqueDetail(t)}>
                      详情
                    </InkButton>
                    <InkButton className="px-2" onClick={() => openForgetConfirm(t)}>
                      废除
                    </InkButton>
                  </div>
                }
              />
            ))}
          </div>
          <AbilityDetailModal
            isOpen={isModalOpen}
            onClose={closeTechniqueDetail}
            product={selectedTechnique}
          />
        </>
      )}
    </GameSceneFrame>
  );
}
