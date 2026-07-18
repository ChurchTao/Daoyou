import { InkButton, InkCard, InkNotice, InkSelect } from '@app/components/ui';
import {
  useInventorySnapshot,
  useProductsSnapshot,
} from '@app/lib/player-state/selectors';
import { fetchSectTasks } from '@app/lib/sect/sectClient';
import type { SectTaskId, SectTaskRecordData, SectTasksData } from '@shared/contracts/sect';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  postJson,
  SectPageLoading,
  SectScene,
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
  const [tasks, setTasks] = useState<SectTasksData>();
  const [selectedMoves, setSelectedMoves] = useState<number[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const inventory = useInventorySnapshot();
  const products = useProductsSnapshot();
  const reload = useCallback(async () => setTasks(await fetchSectTasks()), []);
  useEffect(() => {
    void fetchSectTasks().then(setTasks);
  }, []);
  const { busy, run } = useSectMutation(reload);

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
            selectedMoves={selectedMoves}
            setSelectedMoves={setSelectedMoves}
            selectedItemId={selectedItemId}
            setSelectedItemId={setSelectedItemId}
            items={submitItems}
            run={run}
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
                {task.status !== 'completed' && task.taskId === 'weekly_tournament' ? <InkButton disabled={busy} onClick={() => void run('/api/sects/current/tasks/weekly_tournament/challenge', postJson(), '宗门小比结算完成')}>参加小比</InkButton> : null}
                {task.status !== 'completed' && task.taskId === 'weekly_bounty' && mode !== 'material' ? <InkButton disabled={busy} onClick={() => void run('/api/sects/current/tasks/weekly_bounty/challenge', postJson(), '悬赏残影战结算完成')}>追缉残影</InkButton> : null}
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
          <InkButton disabled={busy || tasks.promotionTask?.status === 'completed'} onClick={() => void run('/api/sects/current/tasks/elder_trial/challenge', postJson(), '长老试炼结算完成')}>
            {tasks.promotionTask?.status === 'completed' ? '试炼已通过' : '挑战长老试炼'}
          </InkButton>
        </InkNotice>
      </section>
    </SectScene>
  );
}

function DailyTaskCard({
  task,
  busy,
  selectedMoves,
  setSelectedMoves,
  selectedItemId,
  setSelectedItemId,
  items,
  run,
}: {
  task: SectTaskRecordData;
  busy: boolean;
  selectedMoves: number[];
  setSelectedMoves: (moves: number[]) => void;
  selectedItemId: string;
  setSelectedItemId: (id: string) => void;
  items: Array<{ id: string; label: string }>;
  run: <T>(url: string, init: RequestInit, message: string) => Promise<T | undefined>;
}) {
  if (task.status === 'completed') return <InkNotice className="mt-3">今日「{taskNames[task.taskId]}」已完成，明日可重新择取委托。</InkNotice>;
  if (task.taskId === 'gate_sweep') {
    return (
      <InkCard className="mt-3" highlighted>
        <strong>清扫山门 · 云阶落叶</strong>
        <p className="text-ink-secondary mt-1 text-sm">点选落叶所在石阶。服务端会核验本日种子生成的目标。</p>
        <div className="mt-3 grid max-w-xs grid-cols-3 gap-2">
          {Array.from({ length: 9 }, (_, index) => (
            <button key={index} type="button" onClick={() => setSelectedMoves(selectedMoves.includes(index) ? selectedMoves.filter((item) => item !== index) : [...selectedMoves, index])} className={`aspect-square border text-xl ${selectedMoves.includes(index) ? 'border-crimson bg-crimson/10' : 'border-ink/20 bg-ink/5'}`} aria-pressed={selectedMoves.includes(index)} aria-label={`第 ${index + 1} 块云阶`}>
              {selectedMoves.includes(index) ? '扫' : '叶'}
            </button>
          ))}
        </div>
        <InkButton variant="primary" disabled={busy || selectedMoves.length < 3} onClick={() => void run('/api/sects/current/tasks/gate_sweep/complete', postJson({ moves: selectedMoves }), '山门清扫完成')}>提交勤务</InkButton>
      </InkCard>
    );
  }
  if (task.taskId === 'mine_patrol') return <InkCard className="mt-3" highlighted><strong>巡视矿场</strong><p className="text-ink-secondary mt-2 text-sm">矿脉附近出现侵扰妖兽，击退后自动结算今日奖励。</p><InkButton variant="primary" disabled={busy} onClick={() => void run('/api/sects/current/tasks/mine_patrol/challenge', postJson(), '矿场巡视结算完成')}>前往迎战</InkButton></InkCard>;
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
