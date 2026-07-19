import { InkCard, InkNotice } from '@app/components/ui';
import { useSectCurrentQuery } from '@app/components/feature/sect/SectQueryProvider';
import { SectPageLoading, SectPermissionBoundary, SectScene } from '../components/SectScene';

export default function SectGatePage() {
  return (
    <SectPermissionBoundary permission="sect.gate.view" title="山门">
      <SectGateBody />
    </SectPermissionBoundary>
  );
}

function SectGateBody() {
  const { data, error } = useSectCurrentQuery();
  if (!data) return <SectPageLoading message="山门晨钟穿过云海……" />;
  const project = data.overview?.project;
  return <SectScene title="山门" description="云阶自群峰之间垂落，守门弟子在晨钟后换过值守；今日宗门内外动静都写在门侧木牌上。" error={error} mood="gate"><div className="relative grid gap-5 border-y border-sky-950/10 py-6 md:grid-cols-[1.2fr_0.8fr]"><span aria-hidden="true" className="absolute top-0 bottom-0 left-1/2 hidden border-l border-dashed border-sky-950/10 md:block" /><InkCard highlighted><h2 className="text-lg font-semibold">今日山门闻讯</h2><ul className="mt-3 space-y-3 text-sm leading-7"><li>晨钟三响，今日执事堂委托已经更新。</li><li>{project ? `百业院正共建${project.targetLevel}级设施，已积累 ${project.progress} 建设点。` : '长老正在议定下一项公共工程。'}</li><li>护山大阵仍处封存演练状态，暂不接受建设捐献。</li></ul></InkCard><div className="flex items-center"><InkNotice>拜师与玩家治理将在后续版本由山门、执事职位和长老峰共同承接。</InkNotice></div></div></SectScene>;
}
