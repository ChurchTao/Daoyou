import { useInkUI } from '@app/components/providers/InkUIProvider';
import type { Material } from '@shared/types/cultivator';
import { AlchemyToolWorkspace } from '../AlchemyToolWorkspace';
import { useAlchemyCraftSession } from '../alchemyCraftContext';
import { AlchemyMaterialShelf } from './AlchemyMaterialShelf';

export function HerbCabinetView({
  onBack,
  onOpenFurnace,
}: {
  onBack(): void;
  onOpenFurnace(): void;
}) {
  const session = useAlchemyCraftSession();
  const { pushToast } = useInkUI();
  const carry = (material: Material) => {
    const outcome = session.addMaterialToFurnace(material);
    if (outcome === 'limit-reached') {
      pushToast({
        message: '本炉材料种类已满，请先到丹炉调整。',
        tone: 'warning',
      });
      return;
    }
    pushToast({
      message:
        outcome === 'already-added'
          ? `【${material.name}】已在炉中，原有剂量保持不变。`
          : `已将【${material.name}】添加到丹炉。`,
      tone: 'success',
    });
    onOpenFurnace();
  };
  return (
    <AlchemyToolWorkspace
      title="查看炼丹材料"
      backLabel="百草药柜"
      onBack={onBack}
    >
      <AlchemyMaterialShelf
        cultivatorId={session.cultivator?.id}
        onCarry={carry}
      />
    </AlchemyToolWorkspace>
  );
}
