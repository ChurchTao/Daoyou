import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { InkCard, InkNotice } from '@app/components/ui';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';

export default function SectGatePage() {
  return (
    <SectPermissionBoundary permission="sect.gate.view" sceneKey="gate">
      <SectGateBody />
    </SectPermissionBoundary>
  );
}

function SectGateBody() {
  const { data, error } = useSectCurrentQuery();
  if (!data) return <SectPageLoading sceneKey="gate" />;
  const project = data.overview?.project;
  return (
    <SectScene sceneKey="gate" error={error} mood="gate">
      <div className="relative grid gap-5 border-y border-sky-950/10 py-6 md:grid-cols-[1.2fr_0.8fr]">
        <span
          aria-hidden="true"
          className="absolute top-0 bottom-0 left-1/2 hidden border-l border-dashed border-sky-950/10 md:block"
        />
        <InkCard highlighted>
          <h2 className="text-lg font-semibold">今日宗门动态</h2>
          <ul className="mt-3 space-y-3 text-sm leading-7">
            <li>今日宗门事务已经更新。</li>
            <li>
              {project
                ? `公共工程正在建设${project.targetLevel}级设施，已积累 ${project.progress} 建设点。`
                : '管理者正在议定下一项公共工程。'}
            </li>
            <li>宗门防护设施暂处封存状态。</li>
          </ul>
        </InkCard>
        <div className="flex items-center">
          <InkNotice>更多宗门治理功能将在后续版本开放。</InkNotice>
        </div>
      </div>
    </SectScene>
  );
}
