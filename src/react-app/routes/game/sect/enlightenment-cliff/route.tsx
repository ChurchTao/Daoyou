import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { PathsTab } from '../components/PathsTab';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
  useSectMutation,
} from '../components/SectScene';

export default function SectEnlightenmentCliffPage() {
  return (
    <SectPermissionBoundary
      permission="sect.enlightenment.use"
      sceneKey="paths"
    >
      <SectEnlightenmentCliffBody />
    </SectPermissionBoundary>
  );
}

function SectEnlightenmentCliffBody() {
  const { data, error, invalidate: reload } = useSectCurrentQuery();
  const cultivator = useActiveCultivatorProfile();
  const { busy, run } = useSectMutation(reload);

  if (!data) return <SectPageLoading sceneKey="paths" />;

  return (
    <SectScene sceneKey="paths" error={error} mood="cliff">
      <div className="relative border-l-2 border-sky-900/15 bg-white/25 px-4 py-5 sm:px-7">
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-3 border-l border-dashed border-sky-950/10"
        />
        <PathsTab
          data={data}
          busy={busy}
          action={async (url, init) => {
            await run(url, init, '流派参悟已更新');
          }}
          realm={cultivator?.realm ?? '炼气'}
          stage={cultivator?.realm_stage ?? '初期'}
        />
      </div>
    </SectScene>
  );
}
