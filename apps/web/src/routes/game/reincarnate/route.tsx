import { apiFetch } from '@app/lib/api/fetch';
import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

const genesisPanelClassName =
  'border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4 md:px-5 md:py-5';

interface ReincarnateContext {
  story?: string;
  name?: string;
  realm?: string;
  realm_stage?: string;
}

export default function ReincarnatePage() {
  const navigate = useNavigate();
  const [context, setContext] = useState<ReincarnateContext | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (typeof window !== 'undefined') {
        const raw = window.sessionStorage.getItem('reincarnateContext');
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as ReincarnateContext;
            if (!cancelled) {
              setContext(parsed);
            }
          } catch (err) {
            console.warn('解析转世上下文失败：', err);
          } finally {
            window.sessionStorage.removeItem('reincarnateContext');
          }
          return;
        }
      }

      try {
        const res = await apiFetch('/api/cultivators/reincarnate-context');
        const json = await res.json();
        if (!res.ok || !json.success || !json.data) return;
        if (!cancelled) {
          setContext(json.data as ReincarnateContext);
        }
      } catch (err) {
        console.warn('获取转世上下文失败：', err);
      }
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className={genesisPanelClassName}>
        <InkSection title="【前世余音】">
          {context?.story ? (
            <div className="border-ink-border bg-bgpaper/80 border border-dashed p-4 text-sm leading-7 whitespace-pre-line">
              {context.story}
            </div>
          ) : (
            <InkNotice>尚无前世故事，可直接返回主界面或重新创建角色。</InkNotice>
          )}
          {context?.name && (
            <p className="text-ink-secondary mt-3 text-sm">
              前世：{context.name}（{context.realm}
              {context.realm_stage}）
            </p>
          )}
        </InkSection>
      </section>

      <aside className="space-y-4">
        <section className={genesisPanelClassName}>
          <div className="text-battle-muted text-[0.72rem] tracking-[0.18em]">
            轮回引导
          </div>
          <div className="text-ink mt-3 space-y-3 text-sm leading-7">
            <p>轮回之门已开，前世故事只作为入道文案参考，本世根骨与机缘仍将重新推演。</p>
            <p>确认后会返回凝气篇，以新身重新定名、择命、入世。</p>
          </div>
        </section>

        <section className={genesisPanelClassName}>
          <InkSection title="【再踏仙途】">
            <p className="text-sm leading-6">
              握紧前世余音，重新凝聚真身，继续此段道途。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <InkButton variant="primary" href="/game/create">
                以新身入道 →
              </InkButton>
              <InkButton onClick={() => navigate('/game')}>返回主界 →</InkButton>
            </div>
          </InkSection>
        </section>
      </aside>
    </div>
  );
}
