import { InkButton, InkCard, InkNotice, InkSelect } from '@app/components/ui';
import {
  useInventorySnapshot,
  useProductsSnapshot,
} from '@app/lib/player-state/selectors';
import { fetchSectTasks } from '@app/lib/sect/sectClient';
import type { SectTaskId, SectTaskRecordData } from '@shared/contracts/sect';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { SweepGameOverlay } from './SweepGameOverlay';
import {
  postJson,
  SectQueryError,
  SectPageLoading,
  SectScene,
  useSectQuery,
  useSectMutation,
} from '../components/SectScene';

const taskNames: Record<SectTaskId, string> = {
  gate_sweep: '清扫山门',
  mine_patrol: '巡视矿场',
  pill_delivery: '丹药委托',
  artifact_delivery: '法宝委托',
  weekly_diligence: '勤务周录',
  weekly_tournament: '宗门小比',
  weekly_bounty: '悬赏令',
  elder_trial: '长老试炼',
};

export default function SectAffairsPage() {
  const navigate = useNavigate();
  const [sweepOpen, setSweepOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState('');
  const inventory = useInventorySnapshot();
  const products = useProductsSnapshot();
  const loadTasks = useCallback((signal: AbortSignal) => fetchSectTasks(signal), []);
  const { data: tasks, error, reload, retry } = useSectQuery(loadTasks);
  const { busy, run } = useSectMutation(reload);
  const startBattle = useCallback(
    (taskId: SectTaskId) =>
      navigate(
        `/game/sect/tasks/${encodeURIComponent(taskId)}/battle?attemptId=${crypto.randomUUID()}`,
      ),
    [navigate],
  );

  const active = tasks?.dailyTask;
  const submitItems = useMemo(() => {
    if (!active) return [];
    if (active.taskId === 'pill_delivery')
      return inventory.consumables
        .filter((item): item is typeof item & { id: string } => Boolean(item.id))
        .map((item) => ({ id: item.id, label: `${item.name} · ${item.quality} · ${item.quantity}枚` }));
    if (active.taskId === 'artifact_delivery')
      return products.artifacts
        .filter((item): item is typeof item & { id: string } => Boolean(item.id) && !item.isEquipped)
        .map((item) => ({ id: item.id, label: `${item.name} · ${item.quality}` }));
    return [];
  }, [active, inventory.consumables, products.artifacts]);

  if (error) return <SectQueryError error={error} retry={() => void retry()} />;
  if (!tasks) return <SectPageLoading message="执事正整理今日委托……" />;
  const bounty = tasks.weeklyTasks.find((task) => task.taskId === 'weekly_bounty');
  return (
    <SectScene
      title="执事堂"
      description="木榜上新令墨迹未干，执事已将今日差事、周录与悬赏分栏钉好；择下一令，便不可在当日更换。"
      mood="affairs"
      aside={<div className="space-y-2 text-sm leading-7"><p>今日：{tasks.dateKey}</p><p>本周：{tasks.weekKey}</p><p>悬赏轮换：{bounty?.payload?.mode === 'material' ? '稀有材料交付' : '叛徒残影战'}</p></div>}
    >
      <section className="border-l-4 border-stone-700/20 bg-[rgba(248,238,211,0.52)] px-4 py-5 shadow-[4px_5px_0_rgba(74,48,28,0.06)]">
        <h2 className="text-lg font-semibold">今日委托</h2>
        {!active ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {tasks.dailyOffers.map((offer) => (
              <InkCard key={offer.id} highlighted={offer.available}>
                <div className="flex items-start justify-between gap-3"><strong>{offer.name}</strong><span className="text-crimson text-sm">+{offer.contributionReward} 贡献</span></div>
                <p className="text-ink-secondary mt-2 text-sm leading-6">{offer.description}</p>
                <InkButton
                  variant="primary"
                  disabled={busy || !offer.available}
                  onClick={() => void run('/api/sects/current/tasks/daily/accept', postJson({ taskId: offer.id }), `已领取「${offer.name}」`)}
                >
                  {offer.available ? '领取委托' : offer.unavailableReason ?? '尚未解锁'}
                </InkButton>
              </InkCard>
            ))}
          </div>
        ) : (
          <DailyTaskCard
            task={active}
            busy={busy}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            items={submitItems}
            run={run}
            startBattle={startBattle}
            startSweep={() => setSweepOpen(true)}
          />
        )}
      </section>

      <section className="border-y border-stone-800/10 py-5">
        <h2 className="text-lg font-semibold">本周宗门录</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {tasks.weeklyTasks.map((task) => {
            const mode = task.payload?.mode;
            return (
              <InkCard key={task.taskId} highlighted={task.status === 'completed'}>
                <div className="flex items-start justify-between gap-2"><strong>{taskNames[task.taskId]}</strong><span className="text-crimson text-sm">+{task.taskId === 'weekly_diligence' ? 20 : task.taskId === 'weekly_tournament' ? 40 : 60}</span></div>
                <p className="mt-2 text-sm">进度 {task.progress} / {task.target}</p>
                {task.taskId === 'weekly_bounty' ? <p className="text-ink-secondary mt-1 text-xs">{mode === 'material' ? '本周需交付 2 份玄品以上材料' : '本周挑战叛徒残影'}</p> : null}
                {task.status !== 'completed' && task.taskId === 'weekly_tournament' ? <InkButton disabled={busy} onClick={() => startBattle(task.taskId)}>参加小比</InkButton> : null}
                {task.status !== 'completed' && task.taskId === 'weekly_bounty' && mode !== 'material' ? <InkButton disabled={busy} onClick={() => startBattle(task.taskId)}>追缉残影</InkButton> : null}
                {task.status !== 'completed' && task.taskId === 'weekly_bounty' && mode === 'material' ? <MaterialBounty task={task} busy={busy} run={run} /> : null}
                {task.status === 'completed' ? <p className="text-crimson mt-2 text-sm">本周已完成</p> : null}
              </InkCard>
            );
          })}
        </div>
      </section>

      <section className="bg-red-950/5 px-4 py-5">
        <h2 className="text-lg font-semibold">晋升试炼</h2>
        <InkNotice className="mt-3">
          真传晋升需在满足金丹境、当前贡献 3000 并完成悬赏后，通过传功长老剑影试炼。
          <InkButton disabled={busy || tasks.promotionTask?.status === 'completed'} onClick={() => startBattle('elder_trial')}>
            {tasks.promotionTask?.status === 'completed' ? '试炼已通过' : '挑战长老试炼'}
          </InkButton>
        </InkNotice>
      </section>
      {sweepOpen ? (
        <SweepGameOverlay
          close={() => setSweepOpen(false)}
          onCompleted={reload}
          run={run}
        />
      ) : null}
    </SectScene>
  );
}

function DailyTaskCard({
  task,
  busy,
  selectedItemId,
  setSelectedItemId,
  items,
  run,
  startBattle,
  startSweep,
}: {
  task: SectTaskRecordData;
  busy: boolean;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  items: Array<{ id: string; label: string }>;
  run: <T>(url: string, init: RequestInit, message: string) => Promise<T | undefined>;
  startBattle: (taskId: SectTaskId) => void;
  startSweep: () => void;
}) {
  if (task.status === 'completed') return <InkNotice className="mt-3">今日「{taskNames[task.taskId]}」已完成，明日可重新择取委托。</InkNotice>;
  if (task.taskId === 'gate_sweep') {
    return (
      <InkCard className="mt-3" highlighted>
        <strong>清扫山门 · 云阶落叶</strong>
        <p className="text-ink-secondary mt-1 text-sm">执帚踏入云阶，在晨钟结束前清理十八片落叶。失败可重试，不消耗今日委托。</p>
        <InkButton variant="primary" disabled={busy} onClick={startSweep}>进入云阶清扫</InkButton>
      </InkCard>
    );
  }
  if (task.taskId === 'mine_patrol') return <InkCard className="mt-3" highlighted><strong>巡视矿场</strong><p className="text-ink-secondary mt-2 text-sm">矿脉附近出现侵扰妖兽，击退后自动结算今日奖励。</p><InkButton variant="primary" disabled={busy} onClick={() => startBattle(task.taskId)}>前往迎战</InkButton></InkCard>;
  return (
    <InkCard className="mt-3" highlighted>
      <strong>{taskNames[task.taskId]}</strong>
      {task.taskId === 'pill_delivery' ? <p className="text-ink-secondary mt-2 text-sm">本次要求：{task.payload?.pillFamily === 'healing' ? '疗伤类' : '回气类'}丹药，凡品以上，1 枚。</p> : null}
      <InkSelect className="mt-3" label="选择交付物" value={selectedItemId} onChange={setSelectedItemId}>
        <option value="">请选择符合要求的物品</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </InkSelect>
      <InkButton variant="primary" disabled={busy || !selectedItemId} onClick={() => void run(`/api/sects/current/tasks/${task.taskId}/submit`, postJson({ itemId: selectedItemId, quantity: 1 }), '委托交付完成')}>确认交付</InkButton>
    </InkCard>
  );
}

function MaterialBounty({ task, busy, run }: { task: SectTaskRecordData; busy: boolean; run: <T>(url: string, init: RequestInit, message: string) => Promise<T | undefined> }) {
  const inventory = useInventorySnapshot();
  const [itemId, setItemId] = useState('');
  return <div className="mt-3"><InkSelect label="稀有材料" value={itemId} onChange={setItemId}><option value="">选择材料</option>{inventory.materials.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.rank} · {item.quantity}份</option>)}</InkSelect><InkButton disabled={busy || !itemId} onClick={() => void run(`/api/sects/current/tasks/${task.taskId}/submit`, postJson({ itemId, quantity: Number(task.payload?.quantity ?? 2) }), '悬赏材料已交付')}>交付材料</InkButton></div>;
}
