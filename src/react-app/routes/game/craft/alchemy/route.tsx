import { InkPageShell, InkSection } from '@app/components/layout';
import { InkActionGroup, InkButton, InkNotice } from '@app/components/ui';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useLocation } from 'react-router';

export default function AlchemyPage() {
  const { note, isLoading } = useCultivator();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="loading-tip">丹火温养中……</p>
      </div>
    );
  }

  return (
    <InkPageShell
      title="【炼丹房】"
      subtitle="系统重构中，暂歇丹火"
      backHref="/game/craft"
      note={note}
      currentPath={pathname}
      footer={
        <InkActionGroup align="between">
          <InkButton href="/game/craft">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            炼丹入口将在 Phase 5 重构完成后恢复
          </span>
        </InkActionGroup>
      }
    >
      <InkSection title="维护公告">
        <InkNotice>
          炼丹系统正在按新 `condition` / `operations` 结构重构。本版本暂不开放即兴炼丹与丹药产出，
          需待 Phase 5 的即兴炼丹重做完成后恢复。
        </InkNotice>
      </InkSection>
    </InkPageShell>
  );
}
