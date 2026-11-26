import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { apiFetch } from '@app/lib/api/fetch';
import type {
  AdminAlchemyContest,
  ContestPreparationResult,
} from '@daoyou/contracts/alchemy/contest';
import { MATERIAL_TYPE_DISPLAY_MAP } from '@daoyou/game-content/presentation/concepts';
import { getAlchemyPropertyLabel } from '@daoyou/game-rules/alchemy';
import { useEffect, useState } from 'react';
import { AdminPageHeader } from '../_components/AdminPage';

const endpoint = '/api/admin/alchemy-contest';
const date = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const outcomes: Record<ContestPreparationResult, string> = {
  prepared: '本期正选题已就绪，新增材料已入库。',
  'reserve-prepared': '备用题已准备完成。',
  'reserve-used': '已启用往期备用题作为本期正选。',
  'already-prepared': '正选与备用题均已就绪。',
  'registration-opened': '本期题卷已锁定或赛期已结束。',
  'generation-disabled': '当前环境已停用模型生成，也没有可用的备用题。',
  'generation-failed': '本次生成未得到通过配伍验证的题目。可稍后手动补跑。',
};

async function read<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = [payload?.message, payload?.error].find(
      (value) => typeof value === 'string',
    );
    throw new Error(detail ?? '炼丹大会管理请求失败。');
  }
  return payload as T;
}

type Round = AdminAlchemyContest['rounds'][number];
type Paper = NonNullable<Round['paper']>;

function PaperData({ label, paper }: { label: string; paper: Paper | null }) {
  if (!paper)
    return <p className="text-ink-secondary text-sm">{label}未准备</p>;
  const { question, materials } = paper;
  const primary = getAlchemyPropertyLabel(question.primary);
  const percentage =
    question.primary === 'restore_mp' || question.primary === 'restore_hp';
  const strength = (value: number) =>
    percentage ? `${Number((value * 100).toFixed(2))}%` : value;
  return (
    <details className="border-ink/15 rounded-sm border px-4 py-2">
      <summary className="cursor-pointer py-2 font-semibold">
        {label} · {question.title}
      </summary>
      <div className="space-y-3 pb-3 text-sm">
        <p>
          目标丹药 <b>{question.pillName}</b>
        </p>
        <p className="text-ink-secondary">{question.brief}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">
          <dt>主药效</dt>
          <dd>
            {primary} ≥{' '}
            <b className="font-mono">{strength(question.minimumStrength)}</b>
          </dd>
          {question.secondary && (
            <>
              <dt>辅药效</dt>
              <dd>{getAlchemyPropertyLabel(question.secondary)}</dd>
            </>
          )}
          <dt>丹毒上限</dt>
          <dd className="font-mono">{question.maximumToxicity}</dd>
          <dt>主药效满分值</dt>
          <dd className="font-mono">
            {strength(question.strengthForFullScore)}
          </dd>
          <dt>产量满分值</dt>
          <dd>
            <b className="font-mono">{question.quantityForFullScore}</b> 枚
          </dd>
        </dl>
        <h4 className="font-semibold">
          参赛材料 <span className="font-mono">{materials.length}</span> 味
        </h4>
        <ul className="divide-ink/15 border-ink/15 divide-y border-y">
          {materials.map((material, index) => (
            <li key={material.id} className="space-y-0.5 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <b>{material.name}</b>
                <span className="text-ink-secondary">
                  {material.rank} · {material.element} ·{' '}
                  {MATERIAL_TYPE_DISPLAY_MAP[material.type].label}
                </span>
                <span className="text-ink-secondary">
                  {index < 8 ? '大会新材' : '材料库抽取'}
                </span>
              </div>
              <p className="break-words">{material.description}</p>
              <p className="text-ink-secondary">
                {material.properties.map(({ key, weight }, index) => (
                  <span key={key}>
                    {index > 0 && '、'}
                    {getAlchemyPropertyLabel(key)}{' '}
                    <b className="font-mono">
                      {Number((weight * 100).toFixed(2))}%
                    </b>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

export default function AlchemyContestAdminPage() {
  const [data, setData] = useState<AdminAlchemyContest | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void apiFetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(read<AdminAlchemyContest>)
      .then((status) => {
        if (!controller.signal.aborted) setData(status);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : '无法读取赛期。');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  async function prepare(week: string) {
    if (pending) return;
    setPending(week);
    setError('');
    setResult('');
    try {
      const response = await apiFetch(endpoint + '/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week }),
      });
      const { status } = await read<{ status: ContestPreparationResult }>(
        response,
      );
      if (
        status === 'registration-opened' ||
        status === 'generation-disabled' ||
        status === 'generation-failed'
      ) {
        setError(outcomes[status]);
      } else {
        setResult(outcomes[status]);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '补跑未返回结果，请刷新查看。',
      );
    } finally {
      setPending(null);
      refresh();
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="炼丹大会管理"
        description="查看本期与下期的正选题、备用题和参赛材料。北京时间开赛后锁定配置。"
        actions={
          <InkButton
            variant="secondary"
            disabled={loading || pending !== null}
            onClick={() => {
              setError('');
              setResult('');
              refresh();
            }}
          >
            刷新赛期
          </InkButton>
        }
      />
      {error && <InkNotice tone="warning">{error}</InkNotice>}
      {result && (
        <p role="status" className="text-teal text-sm">
          {result}
        </p>
      )}
      {loading && !data && (
        <p role="status" className="text-ink-secondary">
          正在读取赛期…
        </p>
      )}
      {data && !data.generationEnabled && (
        <p className="text-ink-secondary text-sm">
          本环境已停用模型生成。有可用备用题时仍可手动启用。
        </p>
      )}
      {data?.rounds.map((round, index) => {
        const status = round.settledAt
          ? '已封榜'
          : round.preparationClosed
            ? round.paper
              ? '配置已锁定'
              : '开赛时间已过，正选题缺失'
            : round.paper
              ? round.reserve
                ? '正选与备用均就绪'
                : '正选已就绪，缺备用题'
              : '待准备';
        return (
          <section
            key={round.week}
            className="border-ink/15 space-y-3 rounded-sm border p-4"
          >
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">
                  {index === 0 ? '本期' : '下期'}{' '}
                  <span className="font-mono">{round.week}</span>
                </h3>
                <p className="text-ink-secondary text-sm">{status}</p>
              </div>
              {round.canPrepare && (
                <InkButton
                  variant="primary"
                  pending={pending === round.week}
                  pendingLabel="准备中…"
                  disabled={
                    loading || (pending !== null && pending !== round.week)
                  }
                  onClick={() => void prepare(round.week)}
                >
                  {data.generationEnabled
                    ? round.paper
                      ? '补跑备用题'
                      : '补跑正选题'
                    : '启用往期备用题'}
                </InkButton>
              )}
            </header>
            <p className="text-ink-secondary text-sm">
              {date.format(new Date(round.opensAt))} 开赛，
              {date.format(new Date(round.closesAt))} 截止
            </p>
            {round.announcedAt && (
              <p className="text-ink-secondary text-sm">
                传闻已发布于 {date.format(new Date(round.announcedAt))}
              </p>
            )}
            {round.canUseReserve &&
              round.canPrepare &&
              data.generationEnabled && (
                <p className="text-ink-secondary text-sm">
                  正选生成失败时可使用往期备用题。
                </p>
              )}
            <PaperData label="正选题" paper={round.paper} />
            <PaperData label="备用题" paper={round.reserve} />
          </section>
        );
      })}
    </div>
  );
}
