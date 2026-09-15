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
  const carry = (material: Material, dose: number) => {
    const outcome = session.addMaterialToFurnace(material, dose);
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
          ? `【${material.name}】已在炉中，份量已更新。`
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
      <AlchemyMaterialShelf onCarry={carry} />
    </AlchemyToolWorkspace>
  );
}
