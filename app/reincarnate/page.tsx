'use client';

import { InkButton, InkNotice } from '@/components/InkComponents';
import { InkPageShell, InkSection } from '@/components/InkLayout';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface ReincarnateContext {
  story?: string;
  name?: string;
  realm?: string;
  realm_stage?: string;
}

export default function ReincarnatePage() {
  const router = useRouter();
  const [context, setContext] = useState<ReincarnateContext | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('reincarnateContext');
    if (raw) {
      try {
        setContext(JSON.parse(raw) as ReincarnateContext);
      } catch (err) {
        console.warn('解析转世上下文失败：', err);
      } finally {
        window.sessionStorage.removeItem('reincarnateContext');
      }
    }
  }, []);

  return (
    <InkPageShell
      title="转世重修"
      subtitle="身死道不灭，握紧前世余荫再闯仙途"
      backHref="/"
    >
      <InkSection title="【前世余音】">
        {context?.story ? (
          <div className="whitespace-pre-line rounded border border-ink-border bg-paper/80 p-4 text-sm leading-7">
            {context.story}
          </div>
        ) : (
          <InkNotice>
            尚无前世故事，可直接返回主界面或重新创建角色。
          </InkNotice>
        )}
        {context?.name && (
          <p className="mt-3 text-sm text-ink-secondary">
            前世：{context.name}（{context.realm}
            {context.realm_stage}）
          </p>
        )}
      </InkSection>
      <InkSection title="【再踏仙途】">
        <p className="text-sm leading-6">
          轮回之门已开，点击下方按钮可携前世记忆（故事文案）重新创建角色。
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <InkButton variant="primary" href="/create">
            以新身入道 →
          </InkButton>
          <InkButton onClick={() => router.push('/')}>返回主界 →</InkButton>
        </div>
      </InkSection>
    </InkPageShell>
  );
}

