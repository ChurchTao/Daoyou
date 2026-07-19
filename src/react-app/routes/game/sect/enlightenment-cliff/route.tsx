import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { PathsTab } from '../components/PathsTab';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
  useSectMutation,
} from '../components/SectScene';

export default function SectEnlightenmentCliffPage() {
  return (
    <SectPermissionBoundary permission="sect.enlightenment.use" title="悟道崖">
      <SectEnlightenmentCliffBody />
    </SectPermissionBoundary>
  );
}

function SectEnlightenmentCliffBody() {
  const { data, error, invalidate: reload } = useSectCurrentQuery();
  const cultivator = useActiveCultivatorProfile();
  const { busy, run } = useSectMutation(reload);

  if (!data) return <SectPageLoading message="崖间云气正在散开……" />;

  return (
    <SectScene
      title="悟道崖"
      description="罡风掠过历代剑痕，每一道石刻皆通向不同道途；择定流派后，沿经脉继续参悟。"
      error={error}
      mood="cliff"
    >
      <div className="relative border-l-2 border-sky-900/15 bg-white/25 px-4 py-5 sm:px-7">
        <span aria-hidden="true" className="absolute top-0 bottom-0 left-3 border-l border-dashed border-sky-950/10" />
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
