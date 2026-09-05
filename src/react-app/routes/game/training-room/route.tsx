import { CombatV6Battle } from '@app/components/feature/combat-v6/CombatV6Battle';
import { CombatV6Page } from '@app/components/feature/combat-v6/CombatV6Page';
import { combatV6Request as request } from '@app/components/feature/combat-v6/request';
import { useCombatV6Session } from '@app/components/feature/combat-v6/useCombatV6Session';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { inkFieldVariants } from '@app/components/ui/inkFieldStyles';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { useCombatV6Build } from '@app/lib/resources/player';
import type {
  CombatV6BuildViewV1,
  CombatV6TrainingSessionViewV1,
} from '@shared/contracts/combatV6';
import { useEffect, useState } from 'react';

type ContentView = {
  tiers: readonly (60 | 120 | 180)[];
  encounters: Array<{ id: string; name: string }>;
};

function BuildInitialization({
  build,
  pending,
  onInitialize,
}: {
  build: CombatV6BuildViewV1;
  pending: boolean;
  onInitialize: (pathId: string) => void;
}) {
  const [pathId, setPathId] = useState(build.paths[0]?.id ?? '');
  return (
    <div className="space-y-4">
      <InkCard variant="highlighted" padding="lg">
        <h2 className="font-heading text-xl">立定 v6 修行流派</h2>
        <p className="text-ink-secondary mt-2 text-sm leading-7">
          当前宗门：{build.sectName}。此阶段完成选择后不可切换、升级或重置。
        </p>
      </InkCard>
      <div className="grid gap-3 md:grid-cols-2">
        {build.paths.map((path) => (
          <button
            key={path.id}
            type="button"
            onClick={() => setPathId(path.id)}
            className={`border p-4 text-left ${pathId === path.id ? 'border-crimson bg-crimson/5' : 'border-ink/15'}`}
          >
            <strong>{path.name}</strong>
            <p className="text-ink-secondary mt-1 text-xs">{path.id}</p>
          </button>
        ))}
      </div>
      <InkCard padding="lg">
        <h3 className="font-semibold">六心法</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {build.methods.map((method) => (
            <div
              key={method.id}
              className="border-ink/10 flex justify-between border-b py-1 text-sm"
            >
              <span>
                {method.name}
                {method.isPrimary ? '（主）' : ''}
              </span>
              <span>{method.level} 级</span>
            </div>
          ))}
        </div>
      </InkCard>
      <InkButton
        variant="primary"
        pending={pending}
        disabled={!pathId}
        onClick={() => onInitialize(pathId)}
      >
        确认流派并开启练功房
      </InkButton>
    </div>
  );
}

function EncounterSelection({
  content,
  pending,
  onCreate,
}: {
  content: ContentView;
  pending: boolean;
  onCreate: (encounterId: string, tier: 60 | 120 | 180) => void;
}) {
  const [encounterId, setEncounterId] = useState(
    content.encounters[0]?.id ?? '',
  );
  const [tier, setTier] = useState<60 | 120 | 180>(60);
  const fieldClass = inkFieldVariants({ size: 'sm' });
  return (
    <InkCard variant="elevated" padding="lg">
      <h2 className="font-heading text-xl">选择演武场景</h2>
      <p className="text-ink-secondary mt-2 text-sm">
        训练不产生奖励、消耗回写或失败成本。
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>场景</span>
          <select
            className={fieldClass}
            value={encounterId}
            onChange={(event) => setEncounterId(event.target.value)}
          >
            {content.encounters.map((encounter) => (
              <option key={encounter.id} value={encounter.id}>
                {encounter.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>训练档位</span>
          <select
            className={fieldClass}
            value={tier}
            onChange={(event) =>
              setTier(Number(event.target.value) as 60 | 120 | 180)
            }
          >
            {content.tiers.map((value) => (
              <option key={value} value={value}>
                {value} 级
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <InkButton
          variant="primary"
          pending={pending}
          disabled={!encounterId}
          onClick={() => onCreate(encounterId, tier)}
        >
          开始训练
        </InkButton>
      </div>
    </InkCard>
  );
}

export default function TrainingRoomPage() {
  const buildQuery = useCombatV6Build();
  const build = buildQuery.data;
  const [content, setContent] = useState<ContentView>();
  const combat = useCombatV6Session<CombatV6TrainingSessionViewV1>(
    '/api/combat-v6/training',
    build?.status === 'active',
  );
  const { session, pending, error, run, acceptSession, submit, resolve } =
    combat;
  const [contentError, setContentError] = useState('');
  useEffect(() => {
    if (build?.status !== 'active') return;
    const controller = new AbortController();
    request<ContentView>('/api/combat-v6/training/content', {
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted) setContent(next);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setContentError(
            cause instanceof Error ? cause.message : '训练内容加载失败',
          );
      });
    return () => controller.abort();
  }, [build?.status]);

  const loading =
    buildQuery.loading ||
    (build?.status === 'active' &&
      (combat.loading || (!content && !contentError)));
  const shownError = error || contentError || buildQuery.error || '';

  return (
    <CombatV6Page
      title="练功房"
      loading={loading && !session}
      error={shownError}
      onRetry={error ? () => void combat.refresh(true) : undefined}
      active={!!session}
    >
      {!loading && build && !build.membershipId ? (
        <InkCard variant="highlighted" padding="lg">
          <h2 className="font-heading text-xl">尚无有效宗门</h2>
          <p className="text-ink-secondary mt-2 text-sm">
            加入已接入 combat-v6 的宗门后方可演武。
          </p>
          <div className="mt-3">
            <InkButton href="/game/sect" variant="primary">
              前往宗门
            </InkButton>
          </div>
        </InkCard>
      ) : null}
      {!loading && build?.membershipId && !build.sectId ? (
        <InkCard variant="highlighted" padding="lg">
          当前宗门尚未接入 combat-v6。
        </InkCard>
      ) : null}
      {!loading && build?.sectId && build.status !== 'active' ? (
        <BuildInitialization
          build={build}
          pending={pending}
          onInitialize={(activePathId) =>
            void run(async () => {
              const response = await fetch('/api/combat-v6/build/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activePathId, expectedRevision: 0 }),
              });
              const next =
                await consumeResourceMutation<CombatV6BuildViewV1>(response);
              buildQuery.setData(next);
            })
          }
        />
      ) : null}
      {!loading && build?.status === 'active' && content && session === null ? (
        <EncounterSelection
          content={content}
          pending={pending}
          onCreate={(encounterId, tier) =>
            void run(async () => {
              acceptSession(
                await request<CombatV6TrainingSessionViewV1>(
                  '/api/combat-v6/training/sessions',
                  {
                    method: 'POST',
                    body: JSON.stringify({ encounterId, tier }),
                  },
                ),
              );
            })
          }
        />
      ) : null}
      {session ? (
        <CombatV6Battle
          key={session.sessionId}
          title={
            content?.encounters.find((e) => e.id === session.encounterId)
              ?.name ?? '练功房'
          }
          session={session}
          pending={pending}
          back="/game"
          backLabel="返回洞府"
          shown={combat.shown}
          log={combat.log}
          playing={combat.playing}
          onCommand={submit}
          onResolve={resolve}
          onClose={() => {
            if (!session.outcome && !window.confirm('确认放弃本次训练？'))
              return;
            void run(async () => {
              await request(
                `/api/combat-v6/training/sessions/${session.sessionId}`,
                {
                  method: 'DELETE',
                  body: JSON.stringify({ expectedRevision: session.revision }),
                },
              );
              acceptSession(null);
            });
          }}
        />
      ) : null}
    </CombatV6Page>
  );
}
