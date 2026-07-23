import {
  useSectCurrentQuery,
  useSectPresentation,
  useSectResourceQuery,
} from '@app/components/feature/sect/SectQueryProvider';
import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { fetchSectTasks } from '@app/lib/sect/sectClient';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  SectPageLoading,
  SectPermissionBoundary,
  SectScene,
} from '../components/SectScene';
import {
  resolveSweepActivityMode,
  sweepActivityMessage,
} from './sweep/sweepActivityState';
import { requestSweepImmersiveMode } from './sweep/sweepImmersive';

export default function SectGatePage() {
  return (
    <SectPermissionBoundary permission="sect.gate.view" sceneKey="gate">
      <SectGateBody />
    </SectPermissionBoundary>
  );
}

function SectGateBody() {
  const { data, error } = useSectCurrentQuery();
  const tasks = useSectResourceQuery('tasks', fetchSectTasks);
  const presentation = useSectPresentation();
  const navigate = useNavigate();
  const [enteringSweep, setEnteringSweep] = useState(false);
  if (!data) return <SectPageLoading sceneKey="gate" />;
  const project = data.overview?.project;
  const sweepMode = resolveSweepActivityMode(tasks.data);
  const enterSweep = async () => {
    setEnteringSweep(true);
    await requestSweepImmersiveMode();
    navigate('/game/sect/gate/sweep');
  };
  return (
    <SectScene sceneKey="gate" error={error ?? tasks.error} mood="gate">
      <InkCard highlighted>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">
                {presentation.terms.sweepActivity}
              </h2>
              <span className="text-crimson text-xs">
                {sweepMode.kind === 'reward' ? '今日委托' : '自由练习'}
              </span>
            </div>
            <p className="text-ink-secondary mt-2 text-sm leading-7">
              收齐四片落叶，避开阻挡与走过的格子，最后一步抵达终点。
            </p>
            <p className="mt-2 text-sm leading-7">
              {sweepActivityMessage(sweepMode)}
            </p>
          </div>
          <InkButton
            variant="primary"
            disabled={enteringSweep || tasks.loading}
            onClick={() => void enterSweep()}
          >
            {enteringSweep
              ? '正在入场……'
              : sweepMode.kind === 'reward'
                ? '开始今日勤务'
                : '进入自由练习'}
          </InkButton>
        </div>
      </InkCard>
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
