import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { MethodsTab } from '../components/MethodsTab';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
  useSectMutation,
} from '../components/SectScene';

export default function SectArchivePage() {
  return (
    <SectPermissionBoundary permission="sect.archive.use" title="藏经阁">
      <SectArchiveBody />
    </SectPermissionBoundary>
  );
}

function SectArchiveBody() {
  const { data, error, invalidate: reload } = useSectCurrentQuery();
  const cultivator = useActiveCultivatorProfile();
  const { busy, run } = useSectMutation(reload);

  if (!data) return <SectPageLoading message="藏经阁卷帙正在归架……" />;

  return (
    <SectScene
      title="藏经阁"
      description="檀木长架沿墙而立，心法卷轴依传承次第展开；在此逐卷研习，不必再穿行别阁。"
      error={error}
      mood="archive"
      aside={
        <div className="space-y-2 text-sm leading-7">
          <p>当前心法上限：{data.methodLevelCap}级</p>
          <p>境界上限：{data.overview?.realmMethodLevelCap ?? data.methodLevelCap}级</p>
        </div>
      }
    >
      <div className="border-amber-900/15 bg-[rgba(255,250,232,0.64)] px-4 py-5 shadow-[inset_18px_0_28px_rgba(91,61,25,0.06)] sm:px-6">
        <MethodsTab
          data={data}
          busy={busy}
          action={async (url, init) => {
            await run(url, init, '心法研习完成');
          }}
          realm={cultivator?.realm ?? '炼气'}
        />
      </div>
    </SectScene>
  );
}
