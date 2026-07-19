import { InkButton, InkCard, InkNotice } from '@app/components/ui';
import { useSectCurrentQuery, useSectResourceQuery } from '@app/components/feature/sect/SectQueryProvider';
import { fetchSectMembers } from '@app/lib/sect/sectClient';
import { getSectFacilityLabel } from '@app/lib/sect/sectPresentation';
import {
  SECT_RANK_LABELS,
} from '@shared/engine/sect';
import {
  postJson,
  rankLabel,
  SectPageLoading,
  SectPermissionBoundary,
  SectQueryError,
  SectScene,
  useSectMutation,
} from '../components/SectScene';

const fetchFirstSectMembersPage = (signal: AbortSignal) =>
  fetchSectMembers(1, 20, signal);

export default function SectHallPage() {
  return (
    <SectPermissionBoundary permission="sect.hall.view" title="宗门大殿">
      <SectHallBody />
    </SectPermissionBoundary>
  );
}

function SectHallBody() {
  const current = useSectCurrentQuery();
  const membersQuery = useSectResourceQuery(
    'members:1:20',
    fetchFirstSectMembersPage,
  );
  const { busy, run } = useSectMutation(membersQuery.reload);

  const error = current.error ?? membersQuery.error;
  if (error)
    return (
      <SectQueryError
        error={error}
        retry={() => void (current.error ? current.retry() : membersQuery.retry())}
      />
    );
  if (!current.data || !membersQuery.data) return <SectPageLoading />;
  const data = current.data;
  const overview = data.overview;
  const members = membersQuery.data;
  const sect = data.sect;
  if (!sect) return <SectScene title="宗门大殿" description="正式入宗后方可入殿。"><InkNotice>尚未拜入宗门。</InkNotice></SectScene>;
  if (!overview)
    return <SectScene title="宗门大殿" description="身份玉牒尚未归档。"><InkNotice>宗门概览暂不可用。</InkNotice></SectScene>;
  const rank = sect.discipleRank ?? 'registered';
  return (
    <SectScene
      title="宗门大殿"
      description="长阶尽处殿门洞开，身份玉牒、俸禄名册与同门长卷皆由录事在此核验。"
      error={error}
      mood="hall"
      aside={<div className="space-y-2 text-sm leading-7"><p>当前身份：{rankLabel(rank)}</p><p>宗门贡献：{sect.contribution}</p><p>心法上限：{overview.methodLevelCap}级</p></div>}
    >
      <div className="relative grid gap-3 border-y border-amber-950/10 py-5 md:grid-cols-3">
        <InkCard highlighted>
          <p className="text-ink-secondary text-xs tracking-widest">弟子身份</p>
          <strong className="mt-2 block text-xl">{SECT_RANK_LABELS[rank]}</strong>
          <p className="mt-2 text-sm">贡献余额 {sect.contribution}</p>
          {overview.nextRank ? (
            <>
              <p className="text-ink-secondary mt-3 text-sm">下一职阶：{SECT_RANK_LABELS[overview.nextRank]}</p>
              {overview.promotionMissing.length ? (
                <ul className="mt-2 list-inside list-disc text-sm leading-6">
                  {overview.promotionMissing.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : <p className="text-crimson mt-2 text-sm">晋升条件均已满足</p>}
              <InkButton
                variant="primary"
                disabled={busy || overview.promotionMissing.length > 0}
                onClick={() => void run('/api/sects/current/promotion', postJson(), '弟子职阶晋升完成')}
              >
                晋升{SECT_RANK_LABELS[overview.nextRank]}
              </InkButton>
            </>
          ) : <p className="text-crimson mt-3 text-sm">已列真传</p>}
        </InkCard>

        <InkCard>
          <p className="text-ink-secondary text-xs tracking-widest">本周俸禄</p>
          <strong className="mt-2 block text-xl">{overview.stipend.spiritStones.toLocaleString()} 灵石</strong>
          {overview.stipend.rewards
            .filter((reward) => reward.kind !== 'sect.reward.spirit-stones')
            .map((reward) => (
              <p
                key={`${reward.kind}:${reward.name}`}
                className="text-ink-secondary mt-1 text-xs"
              >
                {reward.summary}
              </p>
            ))}
          <p className="text-ink-secondary mt-1 text-xs">周次 {overview.stipend.weekKey}</p>
          <InkButton
            variant="primary"
            disabled={busy || overview.stipend.claimed}
            onClick={() => void run('/api/sects/current/stipend/claim', postJson(), '本周宗门俸禄已入账')}
          >
            {overview.stipend.claimed ? '本周已领取' : '领取周俸'}
          </InkButton>
        </InkCard>

        <InkCard>
          <p className="text-ink-secondary text-xs tracking-widest">长老工程</p>
          {overview.project ? (
            <>
              <strong className="mt-2 block text-xl">{getSectFacilityLabel(data.definition!.id, overview.project.facilityKey)} · {overview.project.targetLevel}级</strong>
              <p className="mt-2 text-sm">{overview.project.progress.toLocaleString()} / {overview.project.target.toLocaleString()} 建设点</p>
              <div className="bg-ink/10 mt-3 h-1.5 overflow-hidden"><div className="bg-crimson h-full" style={{ width: `${Math.min(100, (overview.project.progress / overview.project.target) * 100)}%` }} /></div>
            </>
          ) : <p className="mt-3 text-sm">本周工程尚在议定，或已经完成。</p>}
        </InkCard>
      </div>

      <section className="bg-[rgba(255,250,234,0.46)] px-4 py-5 shadow-[inset_16px_0_24px_rgba(91,61,25,0.05)]">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">同门名录</h2><p className="text-ink-secondary mt-1 text-sm">共 {members.total} 位正式成员，职务首版仅作展示。</p></div></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-ink/20 border-b"><tr><th className="p-2">名号</th><th className="p-2">境界</th><th className="p-2">身份</th><th className="p-2">职务</th></tr></thead>
            <tbody>{members.items.map((member) => <tr key={member.cultivatorId} className="border-ink/10 border-b"><td className="p-2 font-semibold">{member.name}</td><td className="p-2">{member.realm}{member.realmStage}</td><td className="p-2">{SECT_RANK_LABELS[member.discipleRank]}</td><td className="p-2">{member.office === 'none' ? '无' : member.office}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </SectScene>
  );
}
