import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkCard } from '@app/components/ui';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

export default function SectCavePage() {
  return (
    <SectPermissionBoundary permission="sect.cave.view" sceneKey="cave">
      <SectCaveBody />
    </SectPermissionBoundary>
  );
}

function SectCaveBody() {
  const { data, error } = useSectCurrentQuery();
  if (!data) return <SectPageLoading sceneKey="cave" />;
  return (
    <SectScene sceneKey="cave" error={error} mood="cave">
      <div className="grid min-h-64 place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,.78),transparent_25%),linear-gradient(90deg,rgba(63,67,59,.12),transparent_18%,transparent_82%,rgba(63,67,59,.12))] px-8 py-10 text-center">
        <InkCard highlighted className="max-w-lg">
          <p className="text-ink-secondary text-xs tracking-[0.3em]">
            弟子居所 · 门禁已启
          </p>
          <p className="text-ink-secondary mt-4 text-sm leading-7">
            此处记录你的宗门居所资格，暂不提供额外数值收益。
          </p>
        </InkCard>
      </div>
    </SectScene>
  );
}
